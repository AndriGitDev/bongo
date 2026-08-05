// Coordinate handling for the "bongó hjá mér" flow.
// Coordinates are rounded to 2 decimals (~1.1 km) before they are used or
// stored anywhere: weather does not need more, and neither do we.

export function isValidCoordinate(lat, lon) {
  return (
    typeof lat === 'number' &&
    typeof lon === 'number' &&
    Number.isFinite(lat) &&
    Number.isFinite(lon) &&
    lat >= -90 &&
    lat <= 90 &&
    lon >= -180 &&
    lon <= 180
  );
}

export function parseCoordinate(raw) {
  if (typeof raw === 'number') {
    return Number.isFinite(raw) ? raw : null;
  }
  if (typeof raw === 'string' && raw.trim() !== '') {
    const value = Number(raw);
    return Number.isFinite(value) ? value : null;
  }
  return null;
}

export function roundCoordinate(value, decimals = 2) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

export function roundLocation({ lat, lon }, decimals = 2) {
  return { lat: roundCoordinate(lat, decimals), lon: roundCoordinate(lon, decimals) };
}

export function distanceKm(a, b) {
  const radius = 6371;
  const toRad = (degrees) => (degrees * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * radius * Math.asin(Math.sqrt(h));
}

export function nearestKnownLocation(point, locations) {
  let best = null;
  for (const location of locations) {
    const distance = distanceKm(point, location);
    if (!best || distance < best.distanceKm) {
      best = { location, distanceKm: distance };
    }
  }
  return best;
}

// Human name for an arbitrary coordinate, relative to the known network of
// bongó stations: "Nálægt Reykjavík" when close, "Þín staðsetning" otherwise.
export function describePlace(point, locations, nearKm = 25) {
  const nearest = nearestKnownLocation(point, locations);
  if (nearest && nearest.distanceKm <= nearKm) {
    return { name: `Nálægt ${nearest.location.name}`, nearest };
  }
  return { name: 'Þín staðsetning', nearest };
}
