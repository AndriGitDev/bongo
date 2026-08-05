import test from 'node:test';
import assert from 'node:assert/strict';

import {
  isValidCoordinate,
  parseCoordinate,
  roundCoordinate,
  roundLocation,
  distanceKm,
  nearestKnownLocation,
  describePlace,
} from '../lib/geo.mjs';

test('isValidCoordinate accepts valid bounds and rejects garbage', () => {
  assert.equal(isValidCoordinate(64.15, -21.94), true);
  assert.equal(isValidCoordinate(90, 180), true);
  assert.equal(isValidCoordinate(-90, -180), true);
  assert.equal(isValidCoordinate(90.0001, 0), false);
  assert.equal(isValidCoordinate(0, 180.5), false);
  assert.equal(isValidCoordinate(NaN, 0), false);
  assert.equal(isValidCoordinate(Infinity, 0), false);
  assert.equal(isValidCoordinate('64.1', -21.9), false);
  assert.equal(isValidCoordinate(null, 0), false);
});

test('parseCoordinate parses strings and numbers, rejects empties and junk', () => {
  assert.equal(parseCoordinate('64.15'), 64.15);
  assert.equal(parseCoordinate(-21.94), -21.94);
  assert.equal(parseCoordinate(' 64.15 '), 64.15);
  assert.equal(parseCoordinate(''), null);
  assert.equal(parseCoordinate('   '), null);
  assert.equal(parseCoordinate('abc'), null);
  assert.equal(parseCoordinate(NaN), null);
  assert.equal(parseCoordinate([64]), null);
  assert.equal(parseCoordinate(undefined), null);
});

test('roundCoordinate rounds to ~1.1 km precision by default', () => {
  assert.equal(roundCoordinate(64.1466), 64.15);
  assert.equal(roundCoordinate(-21.9426), -21.94);
  assert.equal(roundCoordinate(64.1466, 4), 64.1466);
});

test('roundLocation rounds both coordinates', () => {
  assert.deepEqual(roundLocation({ lat: 64.1466, lon: -21.9426 }), { lat: 64.15, lon: -21.94 });
});

test('distanceKm matches hand-computed capital area distances', () => {
  const reykjavik = { lat: 64.1466, lon: -21.9426 };
  const kopavogur = { lat: 64.111, lon: -21.909 };
  const distance = distanceKm(reykjavik, kopavogur);
  assert.ok(distance > 3.5 && distance < 5.5, `expected ~4.3 km, got ${distance}`);
  assert.equal(distanceKm(reykjavik, reykjavik), 0);
});

test('nearestKnownLocation picks the closest station', () => {
  const locations = [
    { id: 'akureyri', name: 'Akureyri', lat: 65.6885, lon: -18.1262 },
    { id: 'reykjavik', name: 'Reykjavík', lat: 64.1466, lon: -21.9426 },
    { id: 'vik', name: 'Vík', lat: 63.4186, lon: -19.006 },
  ];

  const nearest = nearestKnownLocation({ lat: 64.12, lon: -21.91 }, locations);

  assert.equal(nearest.location.id, 'reykjavik');
  assert.ok(nearest.distanceKm < 10);
});

test('describePlace names nearby stations and falls back to anonymous you', () => {
  const locations = [
    { id: 'reykjavik', name: 'Reykjavík', lat: 64.1466, lon: -21.9426 },
    { id: 'akureyri', name: 'Akureyri', lat: 65.6885, lon: -18.1262 },
  ];

  const near = describePlace({ lat: 64.15, lon: -21.94 }, locations);
  assert.equal(near.name, 'Nálægt Reykjavík');

  const remote = describePlace({ lat: 60.0, lon: -10.0 }, locations);
  assert.equal(remote.name, 'Þín staðsetning');
});
