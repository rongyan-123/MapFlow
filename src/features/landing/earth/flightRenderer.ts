import * as THREE from 'three';
import {
  getLandingFlightBudget,
  selectLandingFlights,
  type LandingFlightBudget,
  type LandingFlightRecord,
} from './flightData';
import {
  advanceFlightMotion,
  buildFlightPath,
  createFlightMotionState,
  sampleFlightPathInto,
  type FlightMotionState,
  type LandingFlightPath,
} from './flightMotion';

export interface DenseFlightRendererOptions {
  radius: number;
  records: readonly LandingFlightRecord[];
  budget?: LandingFlightBudget;
}

export interface DenseFlightRendererStats {
  activeFlights: number;
  sourceFlights: number;
  routeSegmentCount: number;
  trailParticleCount: number;
  frame: number;
  elapsedSeconds: number;
  motionSignature: string;
}

interface RenderFlight {
  path: LandingFlightPath;
  state: FlightMotionState;
  color: THREE.Color;
}

const FLIGHT_HEAD_VERTEX_SHADER = `
  attribute float size;
  attribute vec3 color;
  varying vec3 vColor;

  void main() {
    vColor = color;
    vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = clamp(size * 42.0 / max(1.0, -viewPosition.z), 1.5, 8.0);
    gl_Position = projectionMatrix * viewPosition;
  }
`;

const FLIGHT_HEAD_FRAGMENT_SHADER = `
  varying vec3 vColor;

  void main() {
    vec2 point = gl_PointCoord * 2.0 - 1.0;
    float fuselage = 1.0 - smoothstep(0.02, 0.18, abs(point.x));
    fuselage *= 1.0 - smoothstep(0.5, 0.92, abs(point.y));
    float wings = 1.0 - smoothstep(0.02, 0.18, abs(point.y));
    wings *= 1.0 - smoothstep(0.45, 0.9, abs(point.x));
    float alpha = max(fuselage, wings);
    if (alpha < 0.05) discard;
    gl_FragColor = vec4(mix(vColor, vec3(1.0), 0.35), alpha);
  }
`;

const FLIGHT_TRAIL_VERTEX_SHADER = `
  attribute float size;
  attribute float alpha;
  attribute vec3 color;
  varying vec3 vColor;
  varying float vAlpha;

  void main() {
    vColor = color;
    vAlpha = alpha;
    vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = clamp(size * 36.0 / max(1.0, -viewPosition.z), 1.0, 5.5);
    gl_Position = projectionMatrix * viewPosition;
  }
`;

const FLIGHT_TRAIL_FRAGMENT_SHADER = `
  varying vec3 vColor;
  varying float vAlpha;

  void main() {
    float distanceFromCenter = distance(gl_PointCoord, vec2(0.5));
    if (distanceFromCenter > 0.5) discard;
    float edge = 1.0 - smoothstep(0.1, 0.5, distanceFromCenter);
    gl_FragColor = vec4(vColor, edge * vAlpha);
  }
`;

function appendVector(target: number[], vector: THREE.Vector3): void {
  target.push(vector.x, vector.y, vector.z);
}

function appendColor(target: number[], color: THREE.Color): void {
  target.push(color.r, color.g, color.b);
}

function getFlightColor(longitude: number): THREE.Color {
  const hue = ((longitude + 180) % 360 + 360) % 360 / 360;
  return new THREE.Color().setHSL(hue, 0.86, 0.64);
}

function createPointsMaterial(
  vertexShader: string,
  fragmentShader: string,
  uniforms: Record<string, THREE.IUniform> = {},
): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms,
    vertexShader,
    fragmentShader,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
}

export class DenseFlightRenderer {
  readonly group = new THREE.Group();
  readonly budget: LandingFlightBudget;
  readonly sourceFlightCount: number;

  private readonly radius: number;
  private readonly flights: RenderFlight[];
  private readonly headPositions: Float32Array;
  private readonly trailPositions: Float32Array;
  private readonly headGeometry: THREE.BufferGeometry;
  private readonly trailGeometry: THREE.BufferGeometry;
  private readonly routeGeometry: THREE.BufferGeometry;
  private readonly headMaterial: THREE.ShaderMaterial;
  private readonly trailMaterial: THREE.ShaderMaterial;
  private readonly routeMaterial: THREE.LineBasicMaterial;
  private readonly routeGlowMaterial: THREE.LineBasicMaterial;
  private readonly headPoints: THREE.Points;
  private readonly trailPoints: THREE.Points;
  private readonly routeLines: THREE.LineSegments;
  private readonly routeGlow: THREE.LineSegments;
  private readonly trailParticlesPerFlight: number;
  private readonly headScratch = new THREE.Vector3();
  private readonly tangentScratch = new THREE.Vector3();
  private readonly trailScratch = new THREE.Vector3();
  private readonly trailTangentScratch = new THREE.Vector3();
  private frame = 0;
  private elapsedSeconds = 0;
  private motionSignature = '0,0,0';

  constructor(options: DenseFlightRendererOptions) {
    this.radius = options.radius;
    this.budget = options.budget ?? getLandingFlightBudget(1440, 1);
    this.sourceFlightCount = options.records.length;
    this.trailParticlesPerFlight = this.budget.trailParticlesPerFlight;
    const selectedFlights = selectLandingFlights(options.records, this.budget.activeFlights);
    this.flights = selectedFlights.map((flight, index) => ({
      path: buildFlightPath(flight, this.radius, this.budget.pathPoints),
      state: createFlightMotionState(((index * 104729) % 1000) / 1000),
      color: getFlightColor(flight.departure.lng),
    }));

    const routePositions: number[] = [];
    const routeColors: number[] = [];
    for (const flight of this.flights) {
      for (let pointIndex = 0; pointIndex < flight.path.points.length - 1; pointIndex += 2) {
        const start = flight.path.points[pointIndex];
        const end = flight.path.points[Math.min(pointIndex + 1, flight.path.points.length - 1)];
        appendVector(routePositions, start);
        appendVector(routePositions, end);
        appendColor(routeColors, flight.color);
        appendColor(routeColors, flight.color);
      }
    }

    this.routeGeometry = new THREE.BufferGeometry();
    this.routeGeometry.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(routePositions, 3),
    );
    this.routeGeometry.setAttribute('color', new THREE.Float32BufferAttribute(routeColors, 3));
    this.routeMaterial = new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.46,
      depthWrite: false,
      blending: THREE.NormalBlending,
    });
    this.routeGlowMaterial = new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.11,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.routeLines = new THREE.LineSegments(this.routeGeometry, this.routeMaterial);
    this.routeGlow = new THREE.LineSegments(this.routeGeometry, this.routeGlowMaterial);
    this.group.add(this.routeGlow, this.routeLines);

    this.headPositions = new Float32Array(this.flights.length * 3);
    const headColors = new Float32Array(this.flights.length * 3);
    const headSizes = new Float32Array(this.flights.length);
    for (let index = 0; index < this.flights.length; index += 1) {
      appendColorToTypedArray(headColors, index, this.flights[index].color);
      headSizes[index] = 0.9 + (index % 5) * 0.045;
    }
    this.headGeometry = new THREE.BufferGeometry();
    this.headGeometry.setAttribute('position', new THREE.BufferAttribute(this.headPositions, 3));
    this.headGeometry.setAttribute('color', new THREE.BufferAttribute(headColors, 3));
    this.headGeometry.setAttribute('size', new THREE.BufferAttribute(headSizes, 1));
    this.headMaterial = createPointsMaterial(
      FLIGHT_HEAD_VERTEX_SHADER,
      FLIGHT_HEAD_FRAGMENT_SHADER,
    );
    this.headPoints = new THREE.Points(this.headGeometry, this.headMaterial);
    this.group.add(this.headPoints);

    const trailCount = this.flights.length * this.trailParticlesPerFlight;
    this.trailPositions = new Float32Array(trailCount * 3);
    const trailColors = new Float32Array(trailCount * 3);
    const trailSizes = new Float32Array(trailCount);
    const trailAlphas = new Float32Array(trailCount);
    for (let flightIndex = 0; flightIndex < this.flights.length; flightIndex += 1) {
      for (let particleIndex = 0; particleIndex < this.trailParticlesPerFlight; particleIndex += 1) {
        const index = flightIndex * this.trailParticlesPerFlight + particleIndex;
        appendColorToTypedArray(trailColors, index, this.flights[flightIndex].color);
        trailSizes[index] = 0.34 - particleIndex * 0.03;
        trailAlphas[index] = 0.78 - particleIndex * 0.13;
      }
    }
    this.trailGeometry = new THREE.BufferGeometry();
    this.trailGeometry.setAttribute('position', new THREE.BufferAttribute(this.trailPositions, 3));
    this.trailGeometry.setAttribute('color', new THREE.BufferAttribute(trailColors, 3));
    this.trailGeometry.setAttribute('size', new THREE.BufferAttribute(trailSizes, 1));
    this.trailGeometry.setAttribute('alpha', new THREE.BufferAttribute(trailAlphas, 1));
    this.trailMaterial = createPointsMaterial(
      FLIGHT_TRAIL_VERTEX_SHADER,
      FLIGHT_TRAIL_FRAGMENT_SHADER,
    );
    this.trailPoints = new THREE.Points(this.trailGeometry, this.trailMaterial);
    this.group.add(this.trailPoints);

    this.refreshParticlePositions();
  }

  private refreshParticlePositions(): void {
    for (let flightIndex = 0; flightIndex < this.flights.length; flightIndex += 1) {
      const flight = this.flights[flightIndex];
      sampleFlightPathInto(
        flight.path,
        flight.state.progress,
        this.headScratch,
        this.tangentScratch,
      );
      writeVectorToTypedArray(this.headPositions, flightIndex, this.headScratch);
      if (flightIndex === 0) {
        this.motionSignature = [
          this.headScratch.x.toFixed(5),
          this.headScratch.y.toFixed(5),
          this.headScratch.z.toFixed(5),
        ].join(',');
      }

      for (let particleIndex = 0; particleIndex < this.trailParticlesPerFlight; particleIndex += 1) {
        const trailOffset = (particleIndex + 1) * 0.018;
        const trailProgress = Math.max(
          0,
          Math.min(1, flight.state.progress - flight.state.direction * trailOffset),
        );
        sampleFlightPathInto(
          flight.path,
          trailProgress,
          this.trailScratch,
          this.trailTangentScratch,
        );
        writeVectorToTypedArray(
          this.trailPositions,
          flightIndex * this.trailParticlesPerFlight + particleIndex,
          this.trailScratch,
        );
      }
    }
    this.headGeometry.attributes.position.needsUpdate = true;
    this.trailGeometry.attributes.position.needsUpdate = true;
  }

  update(deltaSeconds: number, animate = true): void {
    if (animate) {
      const delta = Math.min(Math.max(deltaSeconds, 0), 0.1);
      for (const flight of this.flights) {
        advanceFlightMotion(flight.state, delta, flight.path.duration);
      }
      this.elapsedSeconds += delta;
    }
    this.frame += 1;
    this.refreshParticlePositions();
  }

  getStats(): DenseFlightRendererStats {
    const routeSegmentCount = this.routeGeometry.getAttribute('position').count / 2;
    return {
      activeFlights: this.flights.length,
      sourceFlights: this.sourceFlightCount,
      routeSegmentCount,
      trailParticleCount: this.flights.length * this.trailParticlesPerFlight,
      frame: this.frame,
      elapsedSeconds: this.elapsedSeconds,
      motionSignature: this.motionSignature,
    };
  }

  dispose(): void {
    this.routeGeometry.dispose();
    this.routeMaterial.dispose();
    this.routeGlowMaterial.dispose();
    this.headGeometry.dispose();
    this.headMaterial.dispose();
    this.trailGeometry.dispose();
    this.trailMaterial.dispose();
    this.group.clear();
  }
}

function writeVectorToTypedArray(
  target: Float32Array,
  index: number,
  vector: THREE.Vector3,
): void {
  const offset = index * 3;
  target[offset] = vector.x;
  target[offset + 1] = vector.y;
  target[offset + 2] = vector.z;
}

function appendColorToTypedArray(
  target: Float32Array,
  index: number,
  color: THREE.Color,
): void {
  const offset = index * 3;
  target[offset] = color.r;
  target[offset + 1] = color.g;
  target[offset + 2] = color.b;
}
