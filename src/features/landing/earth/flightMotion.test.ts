import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import {
  advanceFlightMotion,
  buildFlightPath,
  createFlightMotionState,
  sampleFlightPath,
} from './flightMotion';
import { DenseFlightRenderer } from './flightRenderer';
import {
  getLandingFlightBudget,
  fetchLandingFlightRecords,
  parseLandingFlightPayload,
  selectLandingFlights,
  type LandingFlightRecord,
} from './flightData';

const fixtureFlights: LandingFlightRecord[] = Array.from({ length: 20 }, (_, index) => ({
  departure: { lat: -40 + index * 3, lng: -160 + index * 12 },
  arrival: { lat: 40 - index * 2, lng: 160 - index * 10 },
  speed: 320 + index * 10,
}));

describe('landing flight data budget', () => {
  it('passes an AbortSignal through the flight request and rejects when aborted', async () => {
    const fetcher = vi.fn((_: RequestInfo | URL, init?: RequestInit) => new Promise<Response>((_, reject) => {
      init?.signal?.addEventListener(
        'abort',
        () => reject(new DOMException('The operation was aborted.', 'AbortError')),
        { once: true },
      );
    }));
    const controller = new AbortController();
    const request = fetchLandingFlightRecords('/flights.json', controller.signal, fetcher);

    expect(fetcher).toHaveBeenCalledWith('/flights.json', { signal: controller.signal });
    controller.abort();

    await expect(request).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('parses the packed upstream record shape without changing coordinates', () => {
    expect(parseLandingFlightPayload({ flights: [[12, 34, -12, -34, 480]] })).toEqual([
      {
        departure: { lat: 12, lng: 34 },
        arrival: { lat: -12, lng: -34 },
        speed: 480,
      },
    ]);
    expect(parseLandingFlightPayload({ flights: [[91, 34, -12, -34, 480]] })).toEqual([]);
  });

  it('rejects non-finite and out-of-range object records before budgeting', () => {
    const valid = fixtureFlights[0];
    const records = [
      valid,
      { ...valid, departure: { ...valid.departure, lat: Number.NaN } },
      { ...valid, arrival: { ...valid.arrival, lng: 181 } },
    ];

    expect(parseLandingFlightPayload({ flights: records })).toEqual([valid]);
    expect(selectLandingFlights(records, records.length)).toEqual([valid]);
  });

  it('keeps a dense deterministic subset instead of collapsing to a few routes', () => {
    const selected = selectLandingFlights(fixtureFlights, 12);

    expect(selected).toHaveLength(12);
    expect(new Set(selected.map((flight) => `${flight.departure.lat}:${flight.arrival.lng}`)).size)
      .toBe(12);
    expect(selectLandingFlights(fixtureFlights, 12)).toEqual(selected);
  });

  it('allocates materially more active flights on desktop than a mobile budget', () => {
    const desktop = getLandingFlightBudget(1440, 1);
    const phone = getLandingFlightBudget(390, 2);

    expect(desktop.activeFlights).toBeGreaterThanOrEqual(2000);
    expect(phone.activeFlights).toBeGreaterThanOrEqual(700);
    expect(desktop.activeFlights).toBeGreaterThan(phone.activeFlights);
    expect(desktop.trailParticlesPerFlight).toBeGreaterThanOrEqual(4);
  });
});

describe('landing flight motion', () => {
  it('updates thousands of route and particle buffers independently of scroll', () => {
    const renderer = new DenseFlightRenderer({
      radius: 1.58,
      records: fixtureFlights,
      budget: { activeFlights: 12, pathPoints: 12, trailParticlesPerFlight: 5 },
    });
    const before = renderer.getStats();

    renderer.update(0.35, true);
    const after = renderer.getStats();

    expect(before.activeFlights).toBe(12);
    expect(before.routeSegmentCount).toBeGreaterThan(20);
    expect(before.trailParticleCount).toBe(60);
    expect(after.frame).toBe(1);
    expect(after.elapsedSeconds).toBeGreaterThan(0);
    expect(after.motionSignature).not.toBe(before.motionSignature);
    renderer.dispose();
  });

  it('builds an elevated path from source data and samples a tangent', () => {
    const path = buildFlightPath(fixtureFlights[0], 1.58, 12);
    const sample = sampleFlightPath(path, 0.5);

    expect(path.points).toHaveLength(12);
    expect(sample.position.length()).toBeGreaterThan(1.58);
    expect(sample.tangent.length()).toBeCloseTo(1, 4);
  });

  it('moves the same flight between two fixed camera timestamps', () => {
    const path = buildFlightPath(fixtureFlights[4], 1.58, 12);
    const state = createFlightMotionState(0.23);
    const first = sampleFlightPath(path, state.progress).position;

    advanceFlightMotion(state, 0.75, path.duration);
    const second = sampleFlightPath(path, state.progress).position;

    expect(first.distanceTo(second)).toBeGreaterThan(0.001);
    expect(state.progress).not.toBe(0);
  });

  it('continues after reaching the destination by reversing the route', () => {
    const path = buildFlightPath(fixtureFlights[2], 1.58, 12);
    const state = createFlightMotionState(0.99);
    advanceFlightMotion(state, path.duration * 0.5, path.duration, 0.1);

    expect(state.direction).toBe(-1);
    expect(state.progress).toBeGreaterThanOrEqual(0);
    expect(state.progress).toBeLessThanOrEqual(1);
  });

  it('does not mutate path geometry while sampling', () => {
    const path = buildFlightPath(fixtureFlights[1], 1.58, 12);
    const before = path.points.map((point) => point.clone());

    sampleFlightPath(path, 0.38);

    expect(path.points).toEqual(before);
    expect(new THREE.Vector3().copy(path.points[0]).length()).toBeGreaterThan(1.58);
  });
});
