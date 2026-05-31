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

export function metNoTimeseriesToSnapshot(locationId, entry, providerUpdatedAt) {
  const instant = entry?.data?.instant?.details;
  if (!instant) {
    throw new Error(`MET Norway timeseries entry for ${locationId} had no instant details`);
  }
  const precipitation =
    entry?.data?.next_1_hours?.details?.precipitation_amount ??
    entry?.data?.next_6_hours?.details?.precipitation_amount ??
    entry?.data?.next_12_hours?.details?.precipitation_amount ??
    0;

  return {
    locationId,
    temperatureC: round1(requiredNumber(instant.air_temperature, 'air_temperature')),
    windMs: round1(requiredNumber(instant.wind_speed, 'wind_speed')),
    gustMs: round1(numberOr(instant.wind_speed_of_gust, instant.wind_speed)),
    precipitationMm: round1(numberOr(precipitation, 0)),
    cloudCoverPct: Math.round(requiredNumber(instant.cloud_area_fraction, 'cloud_area_fraction')),
    daylight: isLikelyDaylight(entry.time),
    observedAt: entry.time,
    source: METNO_SOURCE,
    providerUpdatedAt,
  };
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

function isLikelyDaylight(isoTime) {
  // v1 intentionally avoids a heavier solar-position dependency. Icelandic Bongó checks
  // care about the broad day/night distinction; 05-23 UTC is a good summer-friendly bound
  // and harmlessly conservative for winter once live UV/daylight tuning is added.
  const hour = new Date(isoTime).getUTCHours();
  return hour >= 5 && hour <= 23;
}

export async function fetchMetNoSnapshot(location, options = {}) {
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  if (typeof fetchImpl !== 'function') {
    throw new Error('fetch is not available in this runtime');
  }
  const response = await fetchImpl(buildMetNoUrl(location), {
    headers: {
      'User-Agent': 'bongo.andri.is/0.1 (https://bongo.andri.is; hello@andri.is)',
      Accept: 'application/json',
    },
    next: { revalidate: 900 },
  });
  if (!response.ok) {
    throw new Error(`MET Norway returned HTTP ${response.status} for ${location.name}`);
  }
  const payload = await response.json();
  const entry = findBestTimeseriesEntry(payload, options.now ?? new Date());
  return metNoTimeseriesToSnapshot(location.id, entry, payload?.properties?.meta?.updated_at ?? entry.time);
}

export async function fetchLiveSnapshots(locations, options = {}) {
  return Promise.all(
    locations.map(async (location) => {
      try {
        const snapshot = await fetchMetNoSnapshot(location, options);
        return { ok: true, locationId: location.id, snapshot };
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
  const failedLocationIds = [];
  let liveCount = 0;

  for (const result of liveResults) {
    if (result.ok) {
      snapshots[result.snapshot.locationId] = result.snapshot;
      liveCount += 1;
    } else {
      failedLocationIds.push(result.locationId);
    }
  }

  return {
    snapshots,
    failedLocationIds,
    liveCount,
    mode: liveCount === 0 ? 'mock' : failedLocationIds.length === 0 ? 'live' : 'partial-live',
  };
}

export async function getWeatherSnapshots(locations, mockSnapshots, options = {}) {
  const liveResults = await fetchLiveSnapshots(locations, options);
  return mergeLiveSnapshots(mockSnapshots, liveResults);
}
