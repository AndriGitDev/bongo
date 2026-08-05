import test from 'node:test';
import assert from 'node:assert/strict';

import { assembleBongoPayload, moodFromSnapshot } from '../lib/assemble.mjs';

function snapshot(overrides = {}) {
  return {
    locationId: 'you',
    temperatureC: 14,
    windMs: 2,
    gustMs: 4,
    precipitationMm: 0,
    cloudCoverPct: 10,
    sunElevationDeg: 32,
    daylight: true,
    observedAt: '2026-06-05T12:00:00Z',
    source: 'MET Norway Locationforecast',
    providerUpdatedAt: '2026-06-05T06:00:00Z',
    ...overrides,
  };
}

test('moodFromSnapshot prioritizes rain, wind, night and sun', () => {
  assert.equal(moodFromSnapshot(snapshot({ precipitationMm: 1.2 })), 'rain');
  assert.equal(moodFromSnapshot(snapshot({ cloudCoverPct: 92 })), 'rain');
  assert.equal(moodFromSnapshot(snapshot({ windMs: 11 })), 'wind');
  assert.equal(moodFromSnapshot(snapshot({ gustMs: 18 })), 'wind');
  assert.equal(moodFromSnapshot(snapshot({ daylight: false, sunElevationDeg: -8 })), 'night');
  assert.equal(moodFromSnapshot(snapshot({ cloudCoverPct: 5 })), 'sun');
  assert.equal(moodFromSnapshot(snapshot({ cloudCoverPct: 60 })), 'fair');
});

test('assembleBongoPayload builds the canonical client payload', () => {
  const place = { name: 'Nálægt Reykjavík', lat: 64.15, lon: -21.94 };
  const timeline = [
    { ...snapshot(), observedAt: '2026-06-05T12:00:00Z' },
    { ...snapshot(), observedAt: '2026-06-05T13:00:00Z' },
  ];

  const payload = assembleBongoPayload(place, { snapshot: snapshot(), timeline }, {
    now: new Date('2026-06-05T11:30:00Z'),
  });

  assert.deepEqual(payload.place, { name: 'Nálægt Reykjavík', lat: 64.15, lon: -21.94, id: null });
  assert.ok(payload.score >= 75);
  assert.equal(typeof payload.label, 'string');
  assert.match(payload.explanation, /bongó/i);
  assert.equal(payload.timeline.length, 2);
  assert.ok(payload.window, 'identical bongó hours should form a window');
  assert.match(payload.windowMessage, /núna|í dag/);
  assert.equal(payload.source, 'MET Norway Locationforecast');
  assert.equal(payload.mood, 'sun');
});

test('assembleBongoPayload tolerates mock snapshots without timelines', () => {
  const place = { id: 'reykjavik', name: 'Reykjavík', lat: 64.1466, lon: -21.9426 };
  const mockSnapshot = {
    locationId: 'reykjavik',
    temperatureC: 12,
    windMs: 7,
    gustMs: 11,
    precipitationMm: 0,
    cloudCoverPct: 35,
    daylight: true,
    observedAt: '2026-05-31T12:00:00Z',
  };

  const payload = assembleBongoPayload(place, { snapshot: mockSnapshot, timeline: [] }, {
    now: new Date('2026-05-31T12:00:00Z'),
  });

  assert.equal(payload.place.id, 'reykjavik');
  assert.equal(payload.source, 'mock');
  assert.deepEqual(payload.timeline, []);
  assert.equal(payload.window, null);
  assert.match(payload.windowMessage, /Ekkert bongó/);
});
