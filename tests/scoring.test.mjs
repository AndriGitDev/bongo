import test from 'node:test';
import assert from 'node:assert/strict';

import {
  getBongoLabel,
  rankLocations,
  scoreBongo,
  nearestBetterLocations,
} from '../lib/scoring.mjs';

const location = { id: 'rvk', name: 'Reykjavík', lat: 64.1466, lon: -21.9426 };

function snapshot(overrides = {}) {
  return {
    locationId: 'rvk',
    temperatureC: 13,
    windMs: 2,
    gustMs: 4,
    precipitationMm: 0,
    cloudCoverPct: 10,
    daylight: true,
    observedAt: '2026-05-31T12:00:00Z',
    ...overrides,
  };
}

test('sunny calm mild Icelandic day is bongó despite only 13°C', () => {
  const result = scoreBongo(location, snapshot());

  assert.equal(result.score >= 75, true);
  assert.match(result.explanation, /sól|logn/i);
  assert.equal(result.factors.precipitation.score, 100);
});

test('sunny but windy day becomes gluggaveður and explains the wind penalty', () => {
  const result = scoreBongo(location, snapshot({ windMs: 10, gustMs: 16, cloudCoverPct: 5, temperatureC: 18 }));

  assert.equal(result.label, 'Gluggaveður');
  assert.equal(result.score < 60, true);
  assert.match(result.explanation, /glugg|hvasst|vind/i);
});

test('rain and heavy clouds keep the score low', () => {
  const result = scoreBongo(location, snapshot({ precipitationMm: 4.2, cloudCoverPct: 92, windMs: 6, gustMs: 10, temperatureC: 9 }));

  assert.equal(result.score <= 35, true);
  assert.match(result.explanation, /rign|blautt|ský/i);
});

test('label thresholds are deterministic', () => {
  assert.equal(getBongoLabel(94), 'Bongó');
  assert.equal(getBongoLabel(82), 'Bongólegt');
  assert.equal(getBongoLabel(66), 'Næstum bongó');
  assert.equal(getBongoLabel(50), 'Gluggaveður');
  assert.equal(getBongoLabel(25), 'Ekki bongó');
  assert.equal(getBongoLabel(8), 'Farðu inn');
});

test('rankLocations returns top five in deterministic score then name order', () => {
  const locations = [
    { id: 'a', name: 'Akranes', lat: 64.32, lon: -22.07 },
    { id: 'b', name: 'Borgarnes', lat: 64.54, lon: -21.92 },
    { id: 'c', name: 'Akureyri', lat: 65.68, lon: -18.1 },
    { id: 'd', name: 'Selfoss', lat: 63.93, lon: -21.0 },
    { id: 'e', name: 'Vík', lat: 63.42, lon: -19.0 },
    { id: 'f', name: 'Húsavík', lat: 66.04, lon: -17.34 },
  ];
  const snapshots = {
    a: snapshot({ locationId: 'a', cloudCoverPct: 0, windMs: 1 }),
    b: snapshot({ locationId: 'b', cloudCoverPct: 0, windMs: 1 }),
    c: snapshot({ locationId: 'c', cloudCoverPct: 20, windMs: 3 }),
    d: snapshot({ locationId: 'd', precipitationMm: 3, cloudCoverPct: 80 }),
    e: snapshot({ locationId: 'e', windMs: 14, gustMs: 20, precipitationMm: 2, cloudCoverPct: 85 }),
    f: snapshot({ locationId: 'f', cloudCoverPct: 60 }),
  };

  const top = rankLocations(locations, snapshots, 5);

  assert.deepEqual(top.map((entry) => entry.location.name), ['Akranes', 'Borgarnes', 'Akureyri', 'Húsavík', 'Selfoss']);
  assert.equal(top.length, 5);
});

test('nearestBetterLocations finds better nearby options only', () => {
  const current = { id: 'rvk', name: 'Reykjavík', lat: 64.1466, lon: -21.9426 };
  const candidates = [
    current,
    { id: 'akr', name: 'Akranes', lat: 64.3218, lon: -22.0749 },
    { id: 'aku', name: 'Akureyri', lat: 65.6885, lon: -18.1262 },
    { id: 'vik', name: 'Vík', lat: 63.4186, lon: -19.006 },
  ];
  const scored = candidates.map((candidate, index) => ({
    location: candidate,
    score: [45, 70, 88, 20][index],
  }));

  const better = nearestBetterLocations(current, scored, 45, 2);

  assert.deepEqual(better.map((entry) => entry.location.name), ['Akranes', 'Akureyri']);
});
