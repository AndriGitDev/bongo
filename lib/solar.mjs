// Solar position math for the Bongómælir daylight factor.
// Deliberately dependency-free: Cooper's declination + equation of time are
// accurate to well under a degree, which is far more than bongó needs.
// Everything is deterministic and UTC-based (Iceland is UTC year-round).

const RAD = Math.PI / 180;

export function dayOfYearUTC(date) {
  const start = Date.UTC(date.getUTCFullYear(), 0, 1);
  const current = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  return Math.floor((current - start) / 86400000) + 1;
}

export function solarDeclinationDeg(date) {
  const n = dayOfYearUTC(date);
  return 23.45 * Math.sin((2 * Math.PI * (284 + n)) / 365);
}

export function equationOfTimeMinutes(date) {
  const b = (2 * Math.PI * (dayOfYearUTC(date) - 81)) / 364;
  return 9.87 * Math.sin(2 * b) - 7.53 * Math.cos(b) - 1.5 * Math.sin(b);
}

// Solar elevation in degrees for a latitude/longitude at a UTC instant.
export function sunElevationDeg(lat, lon, date) {
  const declination = solarDeclinationDeg(date) * RAD;
  const eotHours = equationOfTimeMinutes(date) / 60;
  const solarTime = date.getUTCHours() + date.getUTCMinutes() / 60 + lon / 15 + eotHours;
  const hourAngle = (solarTime - 12) * 15 * RAD;
  const latitude = lat * RAD;
  const sinElevation =
    Math.sin(latitude) * Math.sin(declination) +
    Math.cos(latitude) * Math.cos(declination) * Math.cos(hourAngle);
  return Math.asin(Math.max(-1, Math.min(1, sinElevation))) / RAD;
}

export function isSunUp(lat, lon, date) {
  return sunElevationDeg(lat, lon, date) > 0;
}

// Daylight tiers feed the 5% "dagsbirta" scoring factor. The thresholds are
// tuned for Iceland: a low sun still counts, civil twilight (-6°..0°) is the
// famous bright summer night, and true dark is a real penalty.
export function daylightTier(elevationDeg) {
  if (elevationDeg >= 5) return { id: 'bright', label: 'bjart', score: 100 };
  if (elevationDeg >= 0) return { id: 'low-sun', label: 'lág sól', score: 70 };
  if (elevationDeg >= -6) return { id: 'twilight', label: 'húm', score: 40 };
  return { id: 'dark', label: 'dimmt', score: 12 };
}
