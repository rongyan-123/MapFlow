export interface LandingGeoPoint {
  lat: number;
  lng: number;
}

export interface LandingFlightRecord {
  departure: LandingGeoPoint;
  arrival: LandingGeoPoint;
  speed: number;
}

export interface LandingFlightBudget {
  activeFlights: number;
  pathPoints: number;
  trailParticlesPerFlight: number;
}

type FlightDataFetcher = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

const GLOBAL_LATITUDE_BANDS = 6;
const GLOBAL_LONGITUDE_BANDS = 12;

function clampInteger(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, Math.floor(value)));
}

function getFlightBucketKey(flight: LandingFlightRecord): string {
  const latitudeBand = clampInteger(
    Math.floor(((flight.departure.lat + 90) / 180) * GLOBAL_LATITUDE_BANDS),
    0,
    GLOBAL_LATITUDE_BANDS - 1,
  );
  const longitudeBand = clampInteger(
    Math.floor(((flight.departure.lng + 180) / 360) * GLOBAL_LONGITUDE_BANDS),
    0,
    GLOBAL_LONGITUDE_BANDS - 1,
  );
  return `${latitudeBand}:${longitudeBand}`;
}

/**
 * Selects a stable, geographically distributed subset of the upstream flight
 * data. Round-robin bucket selection keeps a small viewport from showing only
 * the first region in Data.js while preserving the source records verbatim.
 */
export function selectLandingFlights(
  flights: readonly LandingFlightRecord[],
  requestedCount: number,
): LandingFlightRecord[] {
  const count = clampInteger(requestedCount, 0, flights.length);
  if (count === 0) return [];

  const buckets = new Map<string, LandingFlightRecord[]>();
  for (const flight of flights) {
    if (
      !Number.isFinite(flight.departure.lat) ||
      !Number.isFinite(flight.departure.lng) ||
      !Number.isFinite(flight.arrival.lat) ||
      !Number.isFinite(flight.arrival.lng) ||
      !Number.isFinite(flight.speed) ||
      flight.departure.lat < -90 ||
      flight.departure.lat > 90 ||
      flight.departure.lng < -180 ||
      flight.departure.lng > 180 ||
      flight.arrival.lat < -90 ||
      flight.arrival.lat > 90 ||
      flight.arrival.lng < -180 ||
      flight.arrival.lng > 180 ||
      flight.speed <= 0
    ) {
      continue;
    }
    const key = getFlightBucketKey(flight);
    const bucket = buckets.get(key);
    if (bucket) bucket.push(flight);
    else buckets.set(key, [flight]);
  }

  const orderedBuckets = [...buckets.entries()].sort(([left], [right]) =>
    left.localeCompare(right, undefined, { numeric: true }),
  );
  const selected: LandingFlightRecord[] = [];
  let round = 0;
  while (selected.length < count && orderedBuckets.length > 0) {
    let addedInRound = false;
    for (const [, bucket] of orderedBuckets) {
      const flight = bucket[round];
      if (!flight) continue;
      selected.push(flight);
      addedInRound = true;
      if (selected.length === count) break;
    }
    if (!addedInRound) break;
    round += 1;
  }
  return selected;
}

/**
 * Flight counts intentionally stay in the hundreds/thousands. They are
 * reduced on small or high-density displays, while keeping enough concurrent
 * paths to preserve the source project's living globe impression.
 */
export function getLandingFlightBudget(
  viewportWidth: number,
  devicePixelRatio = 1,
): LandingFlightBudget {
  const width = Math.max(1, viewportWidth);
  const dpr = Math.max(1, devicePixelRatio);
  if (width <= 640) {
    return { activeFlights: 900, pathPoints: 16, trailParticlesPerFlight: 4 };
  }
  if (width <= 1024 || dpr >= 2.4) {
    return { activeFlights: 1600, pathPoints: 20, trailParticlesPerFlight: 5 };
  }
  return { activeFlights: 2800, pathPoints: 24, trailParticlesPerFlight: 6 };
}

export function isLandingFlightRecord(value: unknown): value is LandingFlightRecord {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<LandingFlightRecord>;
  return Boolean(
    candidate.departure &&
      candidate.arrival &&
      Number.isFinite(candidate.departure.lat) &&
      Number.isFinite(candidate.departure.lng) &&
      Number.isFinite(candidate.arrival.lat) &&
      Number.isFinite(candidate.arrival.lng) &&
      candidate.departure.lat >= -90 &&
      candidate.departure.lat <= 90 &&
      candidate.departure.lng >= -180 &&
      candidate.departure.lng <= 180 &&
      candidate.arrival.lat >= -90 &&
      candidate.arrival.lat <= 90 &&
      candidate.arrival.lng >= -180 &&
      candidate.arrival.lng <= 180 &&
      typeof candidate.speed === 'number' &&
      Number.isFinite(candidate.speed) &&
      candidate.speed > 0,
  );
}

export async function fetchLandingFlightRecords(
  url: string,
  signal: AbortSignal,
  fetcher: FlightDataFetcher = fetch,
): Promise<LandingFlightRecord[]> {
  const response = await fetcher(url, { signal });
  if (!response.ok) return [];
  return parseLandingFlightPayload(await response.json());
}

export function parseLandingFlightPayload(payload: unknown): LandingFlightRecord[] {
  const records =
    payload && typeof payload === 'object' && 'flights' in payload
      ? (payload as { flights?: unknown }).flights
      : payload;
  if (!Array.isArray(records)) return [];
  return records.flatMap((record) => {
    if (isLandingFlightRecord(record)) return [record];
    if (
      Array.isArray(record) &&
      record.length >= 5 &&
      record.every((value) => typeof value === 'number' && Number.isFinite(value))
    ) {
      const [departureLat, departureLng, arrivalLat, arrivalLng, speed] = record;
      const packedRecord = {
        departure: { lat: departureLat, lng: departureLng },
        arrival: { lat: arrivalLat, lng: arrivalLng },
        speed,
      };
      return isLandingFlightRecord(packedRecord) ? [packedRecord] : [];
    }
    return [];
  });
}
