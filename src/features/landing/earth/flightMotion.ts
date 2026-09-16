import * as THREE from 'three';
import type { LandingFlightRecord } from './flightData';

const SOURCE_EARTH_RADIUS = 3000;

export interface LandingFlightPath {
  points: THREE.Vector3[];
  duration: number;
}

export interface FlightMotionState {
  progress: number;
  direction: 1 | -1;
  waitRemaining: number;
  seed: number;
}

export interface SampledFlightPoint {
  position: THREE.Vector3;
  tangent: THREE.Vector3;
}

function latLngToVector3(point: { lat: number; lng: number }, radius: number): THREE.Vector3 {
  const phi = ((90 - point.lat) * Math.PI) / 180;
  const theta = ((-point.lng + 180) * Math.PI) / 180;
  const x = radius * Math.sin(phi) * Math.cos(theta);
  return new THREE.Vector3(
    radius * Math.sin(phi) * Math.sin(theta),
    radius * Math.cos(phi),
    -x,
  );
}

function elevatedPoint(
  start: THREE.Vector3,
  end: THREE.Vector3,
  progress: number,
  altitudeRatio: number,
  radius: number,
  cruiseAltitude: number,
): THREE.Vector3 {
  return start
    .clone()
    .lerp(end, progress)
    .normalize()
    .multiplyScalar(radius + cruiseAltitude * altitudeRatio);
}

/**
 * Reproduces the source project's takeoff/cruise/descent curve in the landing
 * globe's smaller coordinate system. The source speeds are expressed against
 * a radius of 3000, so duration is scaled back to those units below.
 */
export function buildFlightPath(
  flight: LandingFlightRecord,
  radius: number,
  pointCount: number,
): LandingFlightPath {
  const safePointCount = Math.max(4, Math.floor(pointCount));
  const start = latLngToVector3(flight.departure, radius + 0.006)
    .normalize()
    .multiplyScalar(radius + 0.006);
  const end = latLngToVector3(flight.arrival, radius + 0.006)
    .normalize()
    .multiplyScalar(radius + 0.006);
  const distance = start.distanceTo(end);
  const maxDistance = radius * Math.PI;
  const distanceRatio = Math.min(distance / Math.max(maxDistance * 0.3, 0.001), 1);
  const cruiseAltitude = 0.018 + (0.22 - 0.018) * Math.pow(distanceRatio, 0.7);

  const controlPoints = [
    start,
    elevatedPoint(start, end, 0.2, 0.4, radius, cruiseAltitude),
    elevatedPoint(start, end, 0.35, 0.75, radius, cruiseAltitude),
    elevatedPoint(start, end, 0.5, 0.85, radius, cruiseAltitude),
    elevatedPoint(start, end, 0.65, 0.75, radius, cruiseAltitude),
    elevatedPoint(start, end, 0.8, 0.4, radius, cruiseAltitude),
    end,
  ];
  const curve = new THREE.CatmullRomCurve3(controlPoints);
  const points = curve.getPoints(safePointCount - 1);
  const duration = Math.max(
    3.5,
    (curve.getLength() * SOURCE_EARTH_RADIUS) / Math.max(flight.speed, 1),
  );
  return { points, duration };
}

export function createFlightMotionState(seed: number): FlightMotionState {
  const normalizedSeed = Number.isFinite(seed) ? Math.max(0, Math.min(1, seed)) : 0;
  return {
    progress: 0.03 + normalizedSeed * 0.94,
    direction: 1,
    waitRemaining: 0,
    seed: normalizedSeed,
  };
}

/**
 * Advances a flight independently of page scrolling. At each destination the
 * source Flight class waits briefly, swaps endpoints, and starts the return
 * leg; this state machine preserves that behavior without allocating objects.
 */
export function advanceFlightMotion(
  state: FlightMotionState,
  deltaSeconds: number,
  duration: number,
  waitSeconds = 0.7,
): FlightMotionState {
  let remaining = Math.max(0, deltaSeconds);
  const safeDuration = Math.max(duration, 0.001);
  const safeWait = Math.max(0, waitSeconds);
  while (remaining > 0) {
    if (state.waitRemaining > 0) {
      const consumed = Math.min(remaining, state.waitRemaining);
      state.waitRemaining -= consumed;
      remaining -= consumed;
      if (state.waitRemaining > 0) continue;
      state.direction = state.direction === 1 ? -1 : 1;
      continue;
    }

    const distanceToEnd = state.direction === 1 ? 1 - state.progress : state.progress;
    const travelSeconds = distanceToEnd * safeDuration;
    if (remaining < travelSeconds) {
      state.progress += (state.direction * remaining) / safeDuration;
      remaining = 0;
      continue;
    }

    state.progress = state.direction === 1 ? 1 : 0;
    remaining -= travelSeconds;
    state.waitRemaining = safeWait;
    if (state.waitRemaining === 0) {
      state.direction = state.direction === 1 ? -1 : 1;
    }
  }
  return state;
}

function catmullRomCoordinate(
  p0: number,
  p1: number,
  p2: number,
  p3: number,
  t: number,
): number {
  const t2 = t * t;
  const t3 = t2 * t;
  return 0.5 * (
    2 * p1 +
    (-p0 + p2) * t +
    (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 +
    (-p0 + 3 * p1 - 3 * p2 + p3) * t3
  );
}

function catmullRomDerivative(
  p0: number,
  p1: number,
  p2: number,
  p3: number,
  t: number,
): number {
  const t2 = t * t;
  return 0.5 * (
    (-p0 + p2) +
    2 * (2 * p0 - 5 * p1 + 4 * p2 - p3) * t +
    3 * (-p0 + 3 * p1 - 3 * p2 + p3) * t2
  );
}

export function sampleFlightPathInto(
  path: LandingFlightPath,
  progress: number,
  position: THREE.Vector3,
  tangent: THREE.Vector3,
): void {
  const segmentCount = Math.max(1, path.points.length - 1);
  const safeProgress = Math.max(0, Math.min(1, progress));
  const segmentPosition = safeProgress * segmentCount;
  const segment = Math.min(segmentCount - 1, Math.floor(segmentPosition));
  const t = segmentPosition - segment;
  const p0 = path.points[Math.max(0, segment - 1)];
  const p1 = path.points[segment];
  const p2 = path.points[Math.min(path.points.length - 1, segment + 1)];
  const p3 = path.points[Math.min(path.points.length - 1, segment + 2)];

  position.set(
    catmullRomCoordinate(p0.x, p1.x, p2.x, p3.x, t),
    catmullRomCoordinate(p0.y, p1.y, p2.y, p3.y, t),
    catmullRomCoordinate(p0.z, p1.z, p2.z, p3.z, t),
  );
  tangent.set(
    catmullRomDerivative(p0.x, p1.x, p2.x, p3.x, t),
    catmullRomDerivative(p0.y, p1.y, p2.y, p3.y, t),
    catmullRomDerivative(p0.z, p1.z, p2.z, p3.z, t),
  ).normalize();
}

export function sampleFlightPath(
  path: LandingFlightPath,
  progress: number,
): SampledFlightPoint {
  const position = new THREE.Vector3();
  const tangent = new THREE.Vector3();
  sampleFlightPathInto(path, progress, position, tangent);
  return { position, tangent };
}
