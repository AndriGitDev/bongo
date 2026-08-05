import { sunElevationDeg } from './solar.mjs';

export const METNO_SOURCE = 'MET Norway Locationforecast';

export function buildMetNoUrl(location) {
  const lat = Number(location.lat).toFixed(4);
  const lon = Number(location.lon).toFixed(4);
  return `https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=${lat}&lon=${lon}`;
}

export function findBestTimeseriesEntry(payload, targetDate = new Date()) {
  const entries = payload?.properties?.timeseries;
  if (!Array.isArray(entries) || entries.length === 0) {
    throw new Error('MET Norway response had no timeseries entries');
  }
  const targetMs = targetDate.getTime();
  return entries.find((entry) => Date.parse(entry.time) >= targetMs) ?? entries[0];
}

function instantFromEntry(locationId, location, entry, providerUpdatedAt, { forTimeline = false } = {}) {
  const instant = entry?.data?.instant?.details;
  if (!instant) {
    throw new Error(`MET Norway timeseries entry for ${locationId} had no instant details`);
  }
  const precipitation =
    entry?.data?.next_1_hours?.details?.precipitation_amount ??
    entry?.data?.next_6_hours?.details?.precipitation_amount ??
    entry?.data?.next_12_hours?.details?.precipitation_amount ??
    0;

  const observedAt = entry.time;
  const elevation = round1(sunElevationDeg(location.lat, location.lon, new Date(observedAt)));

  const base = {
    temperatureC: round1(requiredNumber(instant.air_temperature, 'air_temperature')),
    windMs: round1(requiredNumber(instant.wind_speed, 'wind_speed')),
    gustMs: round1(numberOr(instant.wind_speed_of_gust, instant.wind_speed)),
    precipitationMm: round1(numberOr(precipitation, 0)),
    cloudCoverPct: Math.round(requiredNumber(instant.cloud_area_fraction, 'cloud_area_fraction')),
    sunElevationDeg: elevation,
    daylight: elevation > 0,
    observedAt,
  };

  if (forTimeline) return base;
  return {
    locationId,
    ...base,
    source: METNO_SOURCE,
    providerUpdatedAt,
  };
}

export function metNoTimeseriesToSnapshot(locationId, entry, providerUpdatedAt, location) {
  return instantFromEntry(locationId, location, entry, providerUpdatedAt);
}

// Hourly instants for the next `horizonHours`, straight from the same payload
// the current snapshot came from — the forecast costs no extra API calls.
export function metNoTimeseriesToTimeline(location, payload, { horizonHours = 48, now = new Date() } = {}) {
  const entries = payload?.properties?.timeseries;
  if (!Array.isArray(entries)) return [];
  const horizonEndMs = now.getTime() + horizonHours * 3600000;
  const timeline = [];
  for (const entry of entries) {
    const entryMs = Date.parse(entry.time);
    if (Number.isNaN(entryMs) || entryMs >= horizonEndMs) break;
    try {
      timeline.push(instantFromEntry(location.id, location, entry, null, { forTimeline: true }));
    } catch {
      // Skip malformed entries rather than failing the whole timeline.
    }
  }
  return timeline;
}

function requiredNumber(value, field) {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    throw new Error(`MET Norway field ${field} was missing or invalid`);
  }
  return value;
}

function numberOr(value, fallback) {
  return typeof value === 'number' && !Number.isNaN(value) ? value : fallback;
}

function round1(value) {
  return Math.round(value * 10) / 10;
}

export async function fetchMetNoLocation(location, options = {}) {
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  if (typeof fetchImpl !== 'function') {
    throw new Error('fetch is not available in this runtime');
  }
  const timeoutMs = options.timeoutMs ?? 10000;
  const signal = typeof AbortSignal !== 'undefined' && AbortSignal.timeout ? AbortSignal.timeout(timeoutMs) : undefined;
  const response = await fetchImpl(buildMetNoUrl(location), {
    headers: {
      'User-Agent': 'bongo.andri.is/2.0 (https://bongo.andri.is; hello@andri.is)',
      Accept: 'application/json',
    },
    signal,
    next: { revalidate: 900 },
  });
  if (!response.ok) {
    throw new Error(`MET Norway returned HTTP ${response.status} for ${location.name}`);
  }
  const payload = await response.json();
  const now = options.now ?? new Date();
  const entry = findBestTimeseriesEntry(payload, now);
  const providerUpdatedAt = payload?.properties?.meta?.updated_at ?? entry.time;
  return {
    snapshot: metNoTimeseriesToSnapshot(location.id, entry, providerUpdatedAt, location),
    timeline: metNoTimeseriesToTimeline(location, payload, { now }),
  };
}

export async function fetchMetNoSnapshot(location, options = {}) {
  const { snapshot } = await fetchMetNoLocation(location, options);
  return snapshot;
}

export async function fetchLiveSnapshots(locations, options = {}) {
  return Promise.all(
    locations.map(async (location) => {
      try {
        const { snapshot, timeline } = await fetchMetNoLocation(location, options);
        return { ok: true, locationId: location.id, snapshot, timeline };
      } catch (error) {
        return {
          ok: false,
          locationId: location.id,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    }),
  );
}

export function mergeLiveSnapshots(mockSnapshots, liveResults) {
  const snapshots = { ...mockSnapshots };
  const timelines = {};
  const failedLocationIds = [];
  let liveCount = 0;

  for (const locationId of Object.keys(mockSnapshots)) {
    timelines[locationId] = [];
  }
  for (const result of liveResults) {
    if (result.ok) {
      snapshots[result.snapshot.locationId] = result.snapshot;
      timelines[result.snapshot.locationId] = result.timeline ?? [];
      liveCount += 1;
    } else {
      failedLocationIds.push(result.locationId);
    }
  }

  return {
    snapshots,
    timelines,
    failedLocationIds,
    liveCount,
    mode: liveCount === 0 ? 'mock' : failedLocationIds.length === 0 ? 'live' : 'partial-live',
  };
}

export async function getWeatherSnapshots(locations, mockSnapshots, options = {}) {
  const liveResults = await fetchLiveSnapshots(locations, options);
  return mergeLiveSnapshots(mockSnapshots, liveResults);
}
