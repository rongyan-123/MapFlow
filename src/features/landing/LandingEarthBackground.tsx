import { useEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { createPortal } from 'react-dom';
import * as THREE from 'three';
import {
  getEarthZoom,
  getPointerIntentFromDisplacement,
  MAX_EARTH_ZOOM,
  MIN_EARTH_ZOOM,
} from './landingMotion';
import { LANDING_EARTH_ROUTES } from './landingMapData';
import {
  fetchLandingFlightRecords,
  getLandingFlightBudget,
  parseLandingFlightPayload,
} from './earth/flightData';
import { DenseFlightRenderer } from './earth/flightRenderer';

interface EarthInteractionState {
  rotationX: number;
  rotationY: number;
  zoom: number;
}

interface PointerPoint {
  x: number;
  y: number;
}

interface GestureState {
  mode: 'pending' | 'rotate' | 'pinch' | 'scroll';
  pointerType: string;
  lastX: number;
  lastY: number;
  startX: number;
  startY: number;
  pinchStartDistance: number;
  pinchStartZoom: number;
}

const BASE_CAMERA_DISTANCE = 8;
const EARTH_RADIUS = 1.58;
const EARTH_TEXTURE_URL = `${import.meta.env.BASE_URL}world.topo.jpg`;
const FLIGHT_DATA_URL = `${import.meta.env.BASE_URL}flights/flights.json`;

function updateCameraProjection(
  camera: Pick<THREE.PerspectiveCamera, 'aspect' | 'updateProjectionMatrix'>,
  width: number,
  height: number,
) {
  camera.aspect = width / Math.max(height, 1);
  camera.updateProjectionMatrix();
}

function shouldAnimateEarth(revealProgress: number, reducedMotion: boolean): boolean {
  return revealProgress > 0.08 && !reducedMotion;
}

function hasCanvasSizeChanged(
  previous: { width: number; height: number },
  next: { width: number; height: number },
): boolean {
  return previous.width !== next.width || previous.height !== next.height;
}

function getLandingScrollDelta(previousY: number, currentY: number): number {
  return previousY - currentY;
}

function getLandingWheelDelta(
  deltaY: number,
  deltaMode: number,
  viewportHeight: number,
): number {
  if (deltaMode === 1) return deltaY * 16;
  if (deltaMode === 2) return deltaY * Math.max(1, viewportHeight);
  return deltaY;
}

function getInitialEarthGestureMode(pointerType: string, button: number): GestureState['mode'] {
  return pointerType === 'mouse' && button === 0 ? 'rotate' : 'pending';
}

function shouldForwardLandingScroll(pointerType: string, intent: string): boolean {
  return pointerType !== 'mouse' && intent === 'scroll';
}

function latLngToVector3(lat: number, lng: number, radius: number): THREE.Vector3 {
  const phi = ((90 - lat) * Math.PI) / 180;
  const theta = ((-lng + 180) * Math.PI) / 180;
  const x = radius * Math.sin(phi) * Math.cos(theta);
  return new THREE.Vector3(
    radius * Math.sin(phi) * Math.sin(theta),
    radius * Math.cos(phi),
    -x,
  );
}

function createFallbackEarthTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 768;
  canvas.height = 384;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Earth texture canvas is unavailable');

  const ocean = context.createLinearGradient(0, 0, 0, canvas.height);
  ocean.addColorStop(0, '#174d79');
  ocean.addColorStop(0.52, '#0c315a');
  ocean.addColorStop(1, '#081e3c');
  context.fillStyle = ocean;
  context.fillRect(0, 0, canvas.width, canvas.height);

  context.strokeStyle = 'rgba(120, 210, 239, 0.13)';
  context.lineWidth = 1;
  for (let longitude = -180; longitude <= 180; longitude += 30) {
    const x = ((longitude + 180) / 360) * canvas.width;
    context.beginPath();
    context.moveTo(x, 0);
    context.lineTo(x, canvas.height);
    context.stroke();
  }
  for (let latitude = -60; latitude <= 60; latitude += 30) {
    const y = ((90 - latitude) / 180) * canvas.height;
    context.beginPath();
    context.moveTo(0, y);
    context.lineTo(canvas.width, y);
    context.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

function createStarField(): THREE.Points {
  const starCount = typeof window !== 'undefined' && window.innerWidth < 640 ? 900 : 2600;
  const positions = new Float32Array(starCount * 3);
  const opacities = new Float32Array(starCount);
  let seed = 1987;
  const random = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };

  for (let index = 0; index < starCount; index += 1) {
    const radius = 5.5 + random() * 4.5;
    const theta = random() * Math.PI * 2;
    const phi = Math.acos(2 * random() - 1);
    positions[index * 3] = radius * Math.sin(phi) * Math.cos(theta);
    positions[index * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
    positions[index * 3 + 2] = radius * Math.cos(phi);
    opacities[index] = 0.35 + random() * 0.65;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('starOpacity', new THREE.BufferAttribute(opacities, 1));
  const material = new THREE.ShaderMaterial({
    uniforms: { time: { value: 0 }, opacity: { value: 0.6 } },
    vertexShader: `
      attribute float starOpacity;
      varying float vStarOpacity;

      void main() {
        vStarOpacity = starOpacity;
        vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = 2.2;
        gl_Position = projectionMatrix * viewPosition;
      }
    `,
    fragmentShader: `
      uniform float time;
      uniform float opacity;
      varying float vStarOpacity;

      void main() {
        float distanceFromCenter = distance(gl_PointCoord, vec2(0.5));
        if (distanceFromCenter > 0.5) discard;
        float shimmer = 0.82 + 0.18 * sin(time * 2.0 + vStarOpacity * 9.0);
        float alpha = (1.0 - distanceFromCenter * 2.0) * shimmer * vStarOpacity * opacity;
        gl_FragColor = vec4(0.78, 0.91, 1.0, alpha);
      }
    `,
    transparent: true,
    depthTest: false,
    opacity: 0.6,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  return new THREE.Points(geometry, material);
}

function createFlightRouteCurve(
  origin: THREE.Vector3,
  destination: THREE.Vector3,
  radius: number,
): THREE.CatmullRomCurve3 {
  const surfaceOffset = 0.025;
  const maxCruiseAltitude = 0.2;
  const minCruiseAltitude = 0.015;
  const startSurface = origin.clone().normalize().multiplyScalar(radius + surfaceOffset);
  const endSurface = destination.clone().normalize().multiplyScalar(radius + surfaceOffset);
  const distance = startSurface.distanceTo(endSurface);
  const maxDistance = radius * Math.PI;
  const distanceRatio = Math.min(distance / (maxDistance * 0.3), 1);
  const cruiseAltitude = minCruiseAltitude
    + (maxCruiseAltitude - minCruiseAltitude) * Math.pow(distanceRatio, 0.7);
  const pointAt = (progress: number, altitudeRatio: number) => startSurface
    .clone()
    .lerp(endSurface, progress)
    .normalize()
    .multiplyScalar(radius + cruiseAltitude * altitudeRatio);

  return new THREE.CatmullRomCurve3([
    startSurface,
    pointAt(0.2, 0.4),
    pointAt(0.35, 0.75),
    pointAt(0.5, 0.85),
    pointAt(0.65, 0.75),
    pointAt(0.8, 0.4),
    endSurface,
  ]);
}

function createRouteLines(): THREE.Group {
  const group = new THREE.Group();
  for (const route of LANDING_EARTH_ROUTES) {
    const start = latLngToVector3(route.source[0], route.source[1], EARTH_RADIUS + 0.025);
    const end = latLngToVector3(route.target[0], route.target[1], EARTH_RADIUS + 0.025);
    const curve = createFlightRouteCurve(start, end, EARTH_RADIUS);
    const geometry = new THREE.BufferGeometry().setFromPoints(curve.getPoints(100));
    const material = new THREE.LineBasicMaterial({
      color: route.color,
      transparent: true,
      opacity: 0.62,
      depthWrite: false,
    });
    group.add(new THREE.Line(geometry, material));
  }
  return group;
}

function projectMapPoint(longitude: number, latitude: number, width: number, height: number) {
  return {
    x: ((longitude + 180) / 360) * width,
    y: ((90 - latitude) / 180) * height,
  };
}

function EarthFallback() {
  const routePath = 'M 78 128 C 145 66, 188 92, 226 74 S 300 94, 348 58 M 226 74 C 270 115, 315 138, 374 105';
  return (
    <div
      data-testid="landing-earth-fallback"
      className="mapflow-earth__fallback"
      role="img"
      aria-label="深色星空中的地球与跨洲学习路线"
    >
      <div className="mapflow-earth__fallback-glow" />
      <svg viewBox="0 0 460 300" aria-hidden="true">
        <defs>
          <radialGradient id="mapflow-earth-ocean" cx="42%" cy="34%">
            <stop offset="0" stopColor="#214c78" />
            <stop offset="0.7" stopColor="#0b294b" />
            <stop offset="1" stopColor="#06172f" />
          </radialGradient>
          <filter id="mapflow-earth-blur">
            <feGaussianBlur stdDeviation="8" />
          </filter>
        </defs>
        <circle cx="230" cy="150" r="112" fill="#55c9de" opacity="0.12" filter="url(#mapflow-earth-blur)" />
        <circle cx="230" cy="150" r="98" fill="url(#mapflow-earth-ocean)" stroke="#64d5e7" strokeOpacity="0.58" />
        <path d="M 160 108 C 175 86, 203 82, 218 103 L 201 126 L 174 121 Z M 211 143 C 222 133, 248 134, 255 156 L 241 174 L 220 164 Z M 258 105 C 283 93, 312 105, 326 128 L 305 145 L 278 136 Z M 285 178 C 306 177, 321 189, 315 210 L 285 221 L 269 199 Z" fill="#3b8b78" opacity="0.92" />
        <path d={routePath} fill="none" stroke="#7be7dc" strokeWidth="2.5" strokeLinecap="round" strokeDasharray="5 8" opacity="0.78" />
        <path d="M 138 150 A 92 92 0 0 0 322 150 M 230 52 A 102 102 0 0 0 230 248" fill="none" stroke="#9cebf4" strokeOpacity="0.2" />
        <circle cx="78" cy="128" r="4" fill="#ffd4a3" />
        <circle cx="226" cy="74" r="4" fill="#c79cff" />
        <circle cx="348" cy="58" r="4" fill="#7be7dc" />
        <circle cx="374" cy="105" r="4" fill="#ffad80" />
      </svg>
    </div>
  );
}

interface LandingEarthBackgroundProps {
  revealProgress?: number;
}

export default function LandingEarthBackground({ revealProgress = 1 }: LandingEarthBackgroundProps) {
  const earthRevealProgress = Math.min(1, Math.max(0, Number.isFinite(revealProgress) ? revealProgress : 0));
  const earthIsRevealed = earthRevealProgress > 0.08;
  const earthVisualOpacity = 0.16 + earthRevealProgress * 0.3;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const renderSceneRef = useRef<(() => void) | null>(null);
  const interactionRef = useRef<EarthInteractionState>({
    rotationX: -0.14,
    rotationY: 0.34,
    zoom: 1,
  });
  const pointersRef = useRef(new Map<number, PointerPoint>());
  const gestureRef = useRef<GestureState>({
    mode: 'pending',
    pointerType: 'mouse',
    lastX: 0,
    lastY: 0,
    startX: 0,
    startY: 0,
    pinchStartDistance: 0,
    pinchStartZoom: 1,
  });
  const [webglFailed, setWebglFailed] = useState(false);
  const [interactionHintVisible, setInteractionHintVisible] = useState(true);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [earthZoom, setEarthZoom] = useState(1);
  const earthRevealProgressRef = useRef(earthRevealProgress);
  const reducedMotionRef = useRef(reducedMotion);
  const animationControllerRef = useRef<((shouldRun: boolean) => void) | null>(null);
  const loadFlightDataRef = useRef<(() => void) | null>(null);
  earthRevealProgressRef.current = earthRevealProgress;
  reducedMotionRef.current = reducedMotion;

  const updateZoom = (nextZoom: number, hideHint = true) => {
    const zoom = getEarthZoom(nextZoom);
    interactionRef.current.zoom = zoom;
    setEarthZoom(zoom);
    if (hideHint) setInteractionHintVisible(false);
    renderSceneRef.current?.();
  };

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    if (typeof window.matchMedia !== 'function') return undefined;
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReducedMotion(mediaQuery.matches);
    update();
    mediaQuery.addEventListener?.('change', update);
    return () => mediaQuery.removeEventListener?.('change', update);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || typeof window === 'undefined') return undefined;
    const animationCanvas = canvas;
    if (typeof window.WebGLRenderingContext === 'undefined') {
      setWebglFailed(true);
      return undefined;
    }

    let renderer: THREE.WebGLRenderer | null = null;
    let fallbackEarthTexture: THREE.CanvasTexture | null = null;
    let sourceEarthTexture: THREE.Texture | null = null;
    let earthGeometry: THREE.SphereGeometry | null = null;
    let earthMaterial: THREE.MeshPhongMaterial | null = null;
    let earthMesh: THREE.Mesh<THREE.SphereGeometry, THREE.MeshPhongMaterial> | null = null;
    let atmosphereGeometry: THREE.SphereGeometry | null = null;
    let atmosphereMaterial: THREE.MeshBasicMaterial | null = null;
    let starField: THREE.Points | null = null;
    let routeLines: THREE.Group | null = null;
    let denseFlightRenderer: DenseFlightRenderer | null = null;
    let resizeObserver: ResizeObserver | null = null;
    let textureRequestActive = true;
    const flightDataAbortController = new AbortController();
    let animationFrameId = 0;
    let lastAnimationTimestamp = 0;
    let frameDurationTotal = 0;
    let frameDurationSamples = 0;
    let maxFrameDuration = 0;
    let lastDiagnosticsFrame = -1;
    let renderedSize = { width: 0, height: 0 };
    let flightRecords: ReturnType<typeof parseLandingFlightPayload> | null = null;
    let flightBudgetKey = '';
    let flightLoadStarted = false;
    let isDisposed = false;

    try {
      renderer = new THREE.WebGLRenderer({
        canvas,
        alpha: true,
        antialias: true,
        powerPreference: 'high-performance',
      });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.45));
      renderer.setClearColor(0x000000, 0);

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 30);
      const earthGroup = new THREE.Group();
      earthGroup.position.x = 0.42;
      scene.add(earthGroup);

      fallbackEarthTexture = createFallbackEarthTexture();
      earthGeometry = new THREE.SphereGeometry(EARTH_RADIUS, 56, 36);
      earthMaterial = new THREE.MeshPhongMaterial({
        color: '#5a8ca4',
        map: fallbackEarthTexture,
        shininess: 8,
        specular: new THREE.Color('#245f8f'),
      });
      earthMesh = new THREE.Mesh(earthGeometry, earthMaterial);
      earthMesh.rotation.y = -Math.PI / 2;
      earthGroup.add(earthMesh);

      const textureLoader = new THREE.TextureLoader();
      textureLoader.load(
        EARTH_TEXTURE_URL,
        (texture) => {
          if (!textureRequestActive) {
            texture.dispose();
            return;
          }
          texture.wrapS = THREE.RepeatWrapping;
          texture.wrapT = THREE.ClampToEdgeWrapping;
          texture.minFilter = THREE.LinearFilter;
          texture.magFilter = THREE.LinearFilter;
          texture.flipY = true;
          texture.colorSpace = THREE.SRGBColorSpace;
          sourceEarthTexture = texture;
          if (earthMaterial) {
            earthMaterial.map = texture;
            earthMaterial.needsUpdate = true;
          }
          renderSceneRef.current?.();
        },
        undefined,
        () => {
          // The bundled fallback remains visible when the upstream texture is unavailable.
        },
      );

      atmosphereGeometry = new THREE.SphereGeometry(EARTH_RADIUS * 1.11, 48, 32);
      atmosphereMaterial = new THREE.MeshBasicMaterial({
        color: '#63d9ff',
        transparent: true,
        opacity: 0.11,
        side: THREE.BackSide,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      earthGroup.add(new THREE.Mesh(atmosphereGeometry, atmosphereMaterial));

      routeLines = createRouteLines();
      earthGroup.add(routeLines);
      starField = createStarField();
      scene.add(starField);

      scene.add(new THREE.AmbientLight('#8bb7d8', 1.45));
      const sunLight = new THREE.DirectionalLight('#d9f7ff', 2.25);
      sunLight.position.set(-4, 3, 5);
      scene.add(sunLight);

      const updateFlightDiagnostics = (force = false) => {
        const stats = denseFlightRenderer?.getStats();
        if (!stats) return;
        if (!force && stats.frame - lastDiagnosticsFrame < 6) return;
        lastDiagnosticsFrame = stats.frame;
        canvas.dataset.earthFlightCount = String(stats.activeFlights);
        canvas.dataset.earthFlightSourceCount = String(stats.sourceFlights);
        canvas.dataset.earthFlightRouteSegments = String(stats.routeSegmentCount);
        canvas.dataset.earthFlightTrailParticles = String(stats.trailParticleCount);
        canvas.dataset.earthFlightFrame = String(stats.frame);
        canvas.dataset.earthFlightElapsed = stats.elapsedSeconds.toFixed(3);
        canvas.dataset.earthFlightMotionSignature = stats.motionSignature;
      };

      const renderScene = () => {
        const parent = canvas.parentElement;
        const width = parent?.clientWidth || window.innerWidth;
        const height = parent?.clientHeight || window.innerHeight;
        const size = { width, height };
        if (hasCanvasSizeChanged(renderedSize, size)) {
          renderer?.setSize(width, height, false);
          updateCameraProjection(camera, width, height);
          renderedSize = size;
        }
        camera.position.set(0, 0.04, BASE_CAMERA_DISTANCE / interactionRef.current.zoom);
        camera.lookAt(0, 0, 0);
        earthGroup.rotation.x = interactionRef.current.rotationX;
        earthGroup.rotation.y = interactionRef.current.rotationY;
        if (canvas.dataset.earthRotationX !== interactionRef.current.rotationX.toFixed(4)) {
          canvas.dataset.earthRotationX = interactionRef.current.rotationX.toFixed(4);
        }
        if (canvas.dataset.earthRotationY !== interactionRef.current.rotationY.toFixed(4)) {
          canvas.dataset.earthRotationY = interactionRef.current.rotationY.toFixed(4);
        }
        renderer?.render(scene, camera);
      };
      renderSceneRef.current = renderScene;

      const installFlightRenderer = (records: ReturnType<typeof parseLandingFlightPayload>, width: number) => {
        const budget = getLandingFlightBudget(width, window.devicePixelRatio || 1);
        const nextBudgetKey = `${budget.activeFlights}:${budget.pathPoints}:${budget.trailParticlesPerFlight}`;
        if (denseFlightRenderer && nextBudgetKey === flightBudgetKey) return;
        const previousRenderer = denseFlightRenderer;
        denseFlightRenderer = new DenseFlightRenderer({
          radius: EARTH_RADIUS,
          records,
          budget,
        });
        flightBudgetKey = nextBudgetKey;
        earthGroup.add(denseFlightRenderer.group);
        if (previousRenderer) {
          earthGroup.remove(previousRenderer.group);
          previousRenderer.dispose();
        }
        updateFlightDiagnostics(true);
      };

      const loadFlightData = async () => {
        if (flightLoadStarted) return;
        flightLoadStarted = true;
        try {
          const loadStartedAt = performance.now();
          const records = await fetchLandingFlightRecords(
            FLIGHT_DATA_URL,
            flightDataAbortController.signal,
          );
          const parsedAt = performance.now();
          if (isDisposed || records.length === 0) return;
          flightRecords = records;
          const parent = canvas.parentElement;
          const width = parent?.clientWidth || window.innerWidth;
          installFlightRenderer(records, width);
          renderScene();
          canvas.dataset.earthFlightParseMs = (parsedAt - loadStartedAt).toFixed(1);
          canvas.dataset.earthFlightLoadMs = (performance.now() - loadStartedAt).toFixed(1);
        } catch {
          if (flightDataAbortController.signal.aborted) return;
          // The static route layer remains available when the optional packed flight data cannot load.
        }
      };
      loadFlightDataRef.current = () => {
        void loadFlightData();
      };

      const stopAnimation = () => {
        if (animationFrameId) {
          window.cancelAnimationFrame(animationFrameId);
          animationFrameId = 0;
        }
        lastAnimationTimestamp = 0;
      };

      function animateFrame(timestamp: number) {
        if (isDisposed) return;
        animationFrameId = 0;
        const shouldAnimate = shouldAnimateEarth(
          earthRevealProgressRef.current,
          reducedMotionRef.current,
        );
        if (!shouldAnimate) {
          lastAnimationTimestamp = 0;
          renderScene();
          return;
        }
        if (lastAnimationTimestamp > 0) {
          const frameDuration = timestamp - lastAnimationTimestamp;
          frameDurationTotal += frameDuration;
          frameDurationSamples += 1;
          maxFrameDuration = Math.max(maxFrameDuration, frameDuration);
          animationCanvas.dataset.earthRafIntervalMsAverage =
            (frameDurationTotal / frameDurationSamples).toFixed(2);
          animationCanvas.dataset.earthRafIntervalMsMax = maxFrameDuration.toFixed(2);
        }
        const deltaSeconds = lastAnimationTimestamp === 0
          ? 0
          : Math.min((timestamp - lastAnimationTimestamp) / 1000, 0.1);
        lastAnimationTimestamp = timestamp;
        if (denseFlightRenderer) {
          denseFlightRenderer.update(deltaSeconds, true);
          updateFlightDiagnostics();
        }
        if (starField) {
          const material = starField.material as THREE.ShaderMaterial;
          material.uniforms.time.value += deltaSeconds;
        }
        renderScene();
        animationFrameId = window.requestAnimationFrame(animateFrame);
      }

      const startAnimation = () => {
        if (isDisposed || !shouldAnimateEarth(earthRevealProgressRef.current, reducedMotionRef.current)) {
          return;
        }
        if (!animationFrameId) {
          lastAnimationTimestamp = 0;
          animationFrameId = window.requestAnimationFrame(animateFrame);
        }
      };
      animationControllerRef.current = (shouldRun) => {
        if (shouldRun) startAnimation();
        else stopAnimation();
        renderScene();
      };

      resizeObserver = new ResizeObserver(() => {
        if (flightRecords) {
          const parent = canvas.parentElement;
          const width = parent?.clientWidth || window.innerWidth;
          installFlightRenderer(flightRecords, width);
        }
        renderScene();
      });
      resizeObserver.observe(canvas.parentElement ?? canvas);
      renderScene();
      setWebglFailed(false);
    } catch {
      setWebglFailed(true);
    }

    return () => {
      isDisposed = true;
      if (animationFrameId) window.cancelAnimationFrame(animationFrameId);
      flightDataAbortController.abort();
      textureRequestActive = false;
      resizeObserver?.disconnect();
      animationControllerRef.current = null;
      loadFlightDataRef.current = null;
      renderSceneRef.current = null;
      denseFlightRenderer?.dispose();
      routeLines?.traverse((object) => {
        const line = object as THREE.Line<THREE.BufferGeometry, THREE.LineBasicMaterial>;
        line.geometry?.dispose();
        line.material?.dispose();
      });
      starField?.geometry.dispose();
      (starField?.material as THREE.Material | undefined)?.dispose();
      earthGeometry?.dispose();
      earthMaterial?.dispose();
      fallbackEarthTexture?.dispose();
      sourceEarthTexture?.dispose();
      atmosphereGeometry?.dispose();
      atmosphereMaterial?.dispose();
      renderer?.dispose();
    };
  }, []);

  useEffect(() => {
    const shouldRun = shouldAnimateEarth(earthIsRevealed ? 1 : 0, reducedMotion);
    animationControllerRef.current?.(shouldRun);
    if (earthIsRevealed) loadFlightDataRef.current?.();
  }, [earthIsRevealed, reducedMotion]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;

    const handleNativeWheel = (event: WheelEvent) => {
      if (event.ctrlKey) {
        event.preventDefault();
        updateZoom(interactionRef.current.zoom - event.deltaY * 0.0015);
        return;
      }
      const scrollRoot = canvas.closest<HTMLElement>('.mapflow-landing');
      if (!scrollRoot) return;
      const delta = getLandingWheelDelta(
        event.deltaY,
        event.deltaMode,
        scrollRoot.clientHeight || window.innerHeight,
      );
      if (delta === 0) return;
      event.preventDefault();
      scrollRoot.scrollTop += delta;
    };

    canvas.addEventListener('wheel', handleNativeWheel, { passive: false });
    return () => canvas.removeEventListener('wheel', handleNativeWheel);
  }, []);

  const hideInteractionHint = () => setInteractionHintVisible(false);

  const handlePointerDown = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const pointers = pointersRef.current;
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const gesture = gestureRef.current;
    if (pointers.size >= 2) {
      const [first, second] = Array.from(pointers.values());
      gesture.mode = 'pinch';
      gesture.pinchStartDistance = Math.hypot(first.x - second.x, first.y - second.y);
      gesture.pinchStartZoom = interactionRef.current.zoom;
      hideInteractionHint();
    } else {
      gesture.mode = getInitialEarthGestureMode(event.pointerType, event.button);
      gesture.pointerType = event.pointerType;
      gesture.lastX = event.clientX;
      gesture.lastY = event.clientY;
      gesture.startX = event.clientX;
      gesture.startY = event.clientY;
    }
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Pointer capture is unavailable in a few embedded browser contexts.
    }
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const pointers = pointersRef.current;
    const previous = pointers.get(event.pointerId);
    if (!previous) return;
    const deltaX = event.clientX - previous.x;
    const deltaY = event.clientY - previous.y;
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const gesture = gestureRef.current;

    if (pointers.size >= 2 && gesture.pinchStartDistance > 0) {
      const [first, second] = Array.from(pointers.values());
      const distance = Math.hypot(first.x - second.x, first.y - second.y);
      updateZoom(
        gesture.pinchStartZoom * (distance / gesture.pinchStartDistance),
      );
      event.preventDefault();
      return;
    }

    if (gesture.mode === 'scroll') {
      const scrollRoot = event.currentTarget.closest<HTMLElement>('.mapflow-landing');
      if (scrollRoot) {
        scrollRoot.scrollTop += getLandingScrollDelta(previous.y, event.clientY);
        event.preventDefault();
      }
      return;
    }

    if (gesture.mode === 'pending') {
      const intent = getPointerIntentFromDisplacement(
        event.clientX - gesture.startX,
        event.clientY - gesture.startY,
        1,
      );
      if (intent === 'rotate') {
        gesture.mode = 'rotate';
      } else if (shouldForwardLandingScroll(gesture.pointerType, intent)) {
        gesture.mode = 'scroll';
        const scrollRoot = event.currentTarget.closest<HTMLElement>('.mapflow-landing');
        if (scrollRoot) {
          scrollRoot.scrollTop += getLandingScrollDelta(previous.y, event.clientY);
          event.preventDefault();
        }
        return;
      } else {
        gesture.mode = 'rotate';
      }
    }
    if (gesture.mode !== 'rotate') return;
    gesture.lastX = event.clientX;
    gesture.lastY = event.clientY;
    interactionRef.current.rotationY += deltaX * 0.006;
    interactionRef.current.rotationX = Math.max(
      -1.15,
      Math.min(1.15, interactionRef.current.rotationX + deltaY * 0.004),
    );
    event.preventDefault();
    hideInteractionHint();
    renderSceneRef.current?.();
  };

  const handlePointerEnd = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    pointersRef.current.delete(event.pointerId);
    if (pointersRef.current.size < 2) {
      gestureRef.current.mode = 'pending';
      gestureRef.current.pinchStartDistance = 0;
    }
  };

  const resetView = () => {
    interactionRef.current = { rotationX: -0.14, rotationY: 0.34, zoom: 1 };
    setEarthZoom(1);
    renderSceneRef.current?.();
  };

  const earthControls = earthIsRevealed && !webglFailed ? (
    <div className="mapflow-earth__controls" aria-label="地球视角控制">
      {interactionHintVisible && (
        <span data-testid="landing-earth-interaction-hint" className="mapflow-earth__hint">
          拖动旋转 · Ctrl+滚轮缩放
        </span>
      )}
      <div className="mapflow-earth__zoom-controls" aria-label="地球缩放控制">
        <button
          type="button"
          onClick={() => updateZoom(earthZoom - 0.1)}
          aria-label="缩小地球视角"
        >
          −
        </button>
        <button
          type="button"
          onClick={() => updateZoom(earthZoom + 0.1)}
          aria-label="放大地球视角"
        >
          +
        </button>
        <button type="button" onClick={resetView} aria-label="重置地球视角">
          重置视角
        </button>
      </div>
    </div>
  ) : null;

  return (
    <div
      data-testid="landing-earth-background"
      data-earth-renderer={webglFailed ? 'fallback' : 'webgl'}
      data-earth-revealed={earthIsRevealed ? 'true' : 'false'}
      data-earth-zoom={earthZoom}
      className={`mapflow-earth${earthIsRevealed ? ' is-revealed' : ''}`}
      style={{ opacity: earthVisualOpacity }}
    >
      <canvas
        ref={canvasRef}
        className={`mapflow-earth__canvas${webglFailed ? ' mapflow-earth__canvas--hidden' : ''}`}
        style={{ touchAction: 'none' }}
        aria-label="可交互地球背景，拖动旋转，按住 Ctrl 使用滚轮缩放"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        onPointerCancel={handlePointerEnd}
        onContextMenu={(event) => event.preventDefault()}
      />
      {webglFailed && <EarthFallback />}
      {earthControls && typeof document !== 'undefined'
        ? createPortal(earthControls, document.body)
        : null}
    </div>
  );
}

export {
  createFallbackEarthTexture,
  getLandingScrollDelta,
  getLandingWheelDelta,
  getInitialEarthGestureMode,
  hasCanvasSizeChanged,
  latLngToVector3,
  projectMapPoint,
  shouldAnimateEarth,
  shouldForwardLandingScroll,
  updateCameraProjection,
  MIN_EARTH_ZOOM,
  MAX_EARTH_ZOOM,
};
