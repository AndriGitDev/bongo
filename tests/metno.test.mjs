import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildMetNoUrl,
  findBestTimeseriesEntry,
  metNoTimeseriesToSnapshot,
  mergeLiveSnapshots,
} from '../lib/metno.mjs';

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

test('metNoTimeseriesToSnapshot maps MET Norway fields to Bongómælir weather snapshot', () => {
  const entry = findBestTimeseriesEntry(sample, new Date('2026-05-31T05:30:00Z'));
  const snapshot = metNoTimeseriesToSnapshot('reykjavik', entry, sample.properties.meta.updated_at);

  assert.deepEqual(snapshot, {
    locationId: 'reykjavik',
    temperatureC: 13.4,
    windMs: 2.4,
    gustMs: 4.8,
    precipitationMm: 0,
    cloudCoverPct: 18,
    daylight: true,
    observedAt: '2026-05-31T06:00:00Z',
    source: 'MET Norway Locationforecast',
    providerUpdatedAt: '2026-05-31T06:00:00Z',
  });
});

test('mergeLiveSnapshots keeps mock snapshot when a live result fails', () => {
  const mock = {
    reykjavik: { locationId: 'reykjavik', temperatureC: 12, source: 'mock' },
    akureyri: { locationId: 'akureyri', temperatureC: 17, source: 'mock' },
  };
  const live = [
    { ok: true, snapshot: { locationId: 'reykjavik', temperatureC: 9, source: 'MET Norway Locationforecast' } },
    { ok: false, locationId: 'akureyri', error: 'timeout' },
  ];

  const merged = mergeLiveSnapshots(mock, live);

  assert.equal(merged.snapshots.reykjavik.temperatureC, 9);
  assert.equal(merged.snapshots.akureyri.temperatureC, 17);
  assert.equal(merged.mode, 'partial-live');
  assert.deepEqual(merged.failedLocationIds, ['akureyri']);
});
