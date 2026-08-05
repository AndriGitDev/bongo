import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildMetNoUrl,
  findBestTimeseriesEntry,
  metNoTimeseriesToSnapshot,
  metNoTimeseriesToTimeline,
  mergeLiveSnapshots,
  fetchMetNoLocation,
} from '../lib/metno.mjs';

const reykjavik = { id: 'reykjavik', name: 'Reykjavík', lat: 64.1466, lon: -21.9426 };

const sample = {
  properties: {
    meta: { updated_at: '2026-05-31T06:00:00Z' },
    timeseries: [
      {
        time: '2026-05-31T05:00:00Z',
        data: {
          instant: {
            details: {
              air_temperature: 8,
              cloud_area_fraction: 99,
              wind_speed: 6,
              wind_speed_of_gust: 10,
            },
          },
          next_1_hours: { details: { precipitation_amount: 1.2 } },
        },
      },
      {
        time: '2026-05-31T06:00:00Z',
        data: {
          instant: {
            details: {
              air_temperature: 13.4,
              cloud_area_fraction: 18,
              wind_speed: 2.4,
              wind_speed_of_gust: 4.8,
            },
          },
          next_1_hours: { details: { precipitation_amount: 0 } },
        },
      },
    ],
  },
};

test('buildMetNoUrl uses compact forecast endpoint and rounded coordinates', () => {
  const url = buildMetNoUrl({ lat: 64.1466123, lon: -21.9426123 });

  assert.equal(url, 'https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=64.1466&lon=-21.9426');
});

test('findBestTimeseriesEntry picks the first entry at or after the requested time', () => {
  const entry = findBestTimeseriesEntry(sample, new Date('2026-05-31T05:30:00Z'));

  assert.equal(entry.time, '2026-05-31T06:00:00Z');
});

test('metNoTimeseriesToSnapshot maps MET Norway fields and derives daylight from sun elevation', () => {
  const entry = findBestTimeseriesEntry(sample, new Date('2026-05-31T05:30:00Z'));
  const snapshot = metNoTimeseriesToSnapshot('reykjavik', entry, sample.properties.meta.updated_at, reykjavik);

  assert.equal(snapshot.locationId, 'reykjavik');
  assert.equal(snapshot.temperatureC, 13.4);
  assert.equal(snapshot.windMs, 2.4);
  assert.equal(snapshot.gustMs, 4.8);
  assert.equal(snapshot.precipitationMm, 0);
  assert.equal(snapshot.cloudCoverPct, 18);
  assert.equal(snapshot.observedAt, '2026-05-31T06:00:00Z');
  assert.equal(snapshot.source, 'MET Norway Locationforecast');
  assert.equal(snapshot.providerUpdatedAt, '2026-05-31T06:00:00Z');
  // Reykjavík at 06:00 UTC on May 31: sun is ~11° up.
  assert.ok(snapshot.sunElevationDeg > 8 && snapshot.sunElevationDeg < 14);
  assert.equal(snapshot.daylight, true);
});

test('metNoTimeseriesToTimeline extracts hourly instants inside the horizon', () => {
  const timeline = metNoTimeseriesToTimeline(reykjavik, sample, { now: new Date('2026-05-31T04:30:00Z') });

  assert.equal(timeline.length, 2);
  assert.equal(timeline[0].observedAt, '2026-05-31T05:00:00Z');
  assert.equal(timeline[1].temperatureC, 13.4);
  assert.equal(typeof timeline[1].sunElevationDeg, 'number');
  assert.equal('source' in timeline[1], false);
});

test('metNoTimeseriesToTimeline respects the horizon cutoff', () => {
  const timeline = metNoTimeseriesToTimeline(reykjavik, sample, {
    now: new Date('2026-05-31T04:30:00Z'),
    horizonHours: 0.75,
  });

  assert.equal(timeline.length, 1);
});

test('metNoTimeseriesToTimeline skips malformed entries without failing', () => {
  const payload = {
    properties: {
      timeseries: [
        { time: '2026-05-31T05:00:00Z', data: {} },
        sample.properties.timeseries[1],
      ],
    },
  };

  const timeline = metNoTimeseriesToTimeline(reykjavik, payload, { now: new Date('2026-05-31T04:00:00Z') });

  assert.equal(timeline.length, 1);
  assert.equal(timeline[0].observedAt, '2026-05-31T06:00:00Z');
});

test('fetchMetNoLocation sends the required user agent and returns snapshot + timeline', async () => {
  let requestedUrl;
  let requestedInit;
  const fetchImpl = async (url, init) => {
    requestedUrl = url;
    requestedInit = init;
    return { ok: true, json: async () => sample };
  };

  const { snapshot, timeline } = await fetchMetNoLocation(reykjavik, {
    fetchImpl,
    now: new Date('2026-05-31T05:30:00Z'),
  });

  assert.equal(requestedUrl, buildMetNoUrl(reykjavik));
  assert.match(requestedInit.headers['User-Agent'], /^bongo\.andri\.is\//);
  assert.equal(snapshot.temperatureC, 13.4);
  assert.equal(timeline.length, 2);
});

test('fetchMetNoLocation rejects on non-2xx responses', async () => {
  const fetchImpl = async () => ({ ok: false, status: 503, json: async () => ({}) });

  await assert.rejects(
    () => fetchMetNoLocation(reykjavik, { fetchImpl }),
    /HTTP 503/,
  );
});

test('mergeLiveSnapshots keeps mock snapshot when a live result fails', () => {
  const mock = {
    reykjavik: { locationId: 'reykjavik', temperatureC: 12, source: 'mock' },
    akureyri: { locationId: 'akureyri', temperatureC: 17, source: 'mock' },
  };
  const live = [
    { ok: true, snapshot: { locationId: 'reykjavik', temperatureC: 9, source: 'MET Norway Locationforecast' }, timeline: [{ time: 'a' }] },
    { ok: false, locationId: 'akureyri', error: 'timeout' },
  ];

  const merged = mergeLiveSnapshots(mock, live);

  assert.equal(merged.snapshots.reykjavik.temperatureC, 9);
  assert.equal(merged.snapshots.akureyri.temperatureC, 17);
  assert.deepEqual(merged.timelines.reykjavik, [{ time: 'a' }]);
  assert.deepEqual(merged.timelines.akureyri, []);
  assert.equal(merged.mode, 'partial-live');
  assert.deepEqual(merged.failedLocationIds, ['akureyri']);
});
