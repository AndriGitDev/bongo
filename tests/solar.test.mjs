import test from 'node:test';
import assert from 'node:assert/strict';

import {
  dayOfYearUTC,
  solarDeclinationDeg,
  sunElevationDeg,
  isSunUp,
  daylightTier,
} from '../lib/solar.mjs';

const REYKJAVIK = { lat: 64.1466, lon: -21.9426 };

test('dayOfYearUTC handles both ends of the year', () => {
  assert.equal(dayOfYearUTC(new Date('2026-01-01T00:00:00Z')), 1);
  assert.equal(dayOfYearUTC(new Date('2026-12-31T23:00:00Z')), 365);
  assert.equal(dayOfYearUTC(new Date('2024-12-31T23:00:00Z')), 366);
});

test('solar declination matches the solstices and equinoxes', () => {
  assert.ok(Math.abs(solarDeclinationDeg(new Date('2026-06-21T12:00:00Z')) - 23.45) < 1.2);
  assert.ok(Math.abs(solarDeclinationDeg(new Date('2026-12-21T12:00:00Z')) + 23.45) < 1.2);
  assert.ok(Math.abs(solarDeclinationDeg(new Date('2026-03-20T12:00:00Z'))) < 1.2);
});

test('Reykjavík summer solstice: high sun around solar noon', () => {
  // Solar noon in Reykjavík is ≈ 13:27 UTC; max elevation ≈ 49°.
  const elevation = sunElevationDeg(REYKJAVIK.lat, REYKJAVIK.lon, new Date('2026-06-21T13:27:00Z'));
  assert.ok(elevation > 46 && elevation < 52, `expected ~49°, got ${elevation}`);
});

test('Reykjavík winter solstice: the sun barely rises and sets early', () => {
  const noon = sunElevationDeg(REYKJAVIK.lat, REYKJAVIK.lon, new Date('2026-12-21T13:27:00Z'));
  assert.ok(noon > 0 && noon < 6, `expected ~2.4°, got ${noon}`);

  const lateAfternoon = sunElevationDeg(REYKJAVIK.lat, REYKJAVIK.lon, new Date('2026-12-21T17:00:00Z'));
  assert.ok(lateAfternoon < 0);
});

test('Reykjavík midsummer midnight: sun just dips below the horizon', () => {
  // The famous bright nights: at 00:00 UTC on June 21 the sun is ~2° down.
  const elevation = sunElevationDeg(REYKJAVIK.lat, REYKJAVIK.lon, new Date('2026-06-21T00:00:00Z'));
  assert.ok(elevation > -5 && elevation < 0, `expected ~-2.4°, got ${elevation}`);
  assert.equal(isSunUp(REYKJAVIK.lat, REYKJAVIK.lon, new Date('2026-06-21T00:00:00Z')), false);
  assert.equal(isSunUp(REYKJAVIK.lat, REYKJAVIK.lon, new Date('2026-06-21T13:27:00Z')), true);
});

test('southern hemisphere seasons are inverted', () => {
  const capeTown = { lat: -33.9, lon: 18.42 };
  const decemberNoon = sunElevationDeg(capeTown.lat, capeTown.lon, new Date('2026-12-21T11:00:00Z'));
  const juneNoon = sunElevationDeg(capeTown.lat, capeTown.lon, new Date('2026-06-21T11:00:00Z'));
  assert.ok(decemberNoon > 65, `expected high summer sun, got ${decemberNoon}`);
  assert.ok(juneNoon < 40, `expected low winter sun, got ${juneNoon}`);
});

test('daylightTier thresholds are deterministic and ordered', () => {
  assert.deepEqual(daylightTier(10), { id: 'bright', label: 'bjart', score: 100 });
  assert.deepEqual(daylightTier(2), { id: 'low-sun', label: 'lág sól', score: 70 });
  assert.deepEqual(daylightTier(-3), { id: 'twilight', label: 'húm', score: 40 });
  assert.deepEqual(daylightTier(-10), { id: 'dark', label: 'dimmt', score: 12 });
});
