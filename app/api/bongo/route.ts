import { NextResponse } from 'next/server';

import { assembleBongoPayload } from '../../../lib/assemble.mjs';
import { describePlace, isValidCoordinate, parseCoordinate, roundLocation } from '../../../lib/geo.mjs';
import { fetchMetNoLocation } from '../../../lib/metno.mjs';
import { nearestKnownLocation } from '../../../lib/geo.mjs';
import { locations, mockWeatherByLocationId } from '../../../lib/mock-data';

export const dynamic = 'force-dynamic';
// Vercel Hobby's default function timeout (10 s) exactly matches the MET Norway
// fetch timeout — give slow responses and cold starts breathing room.
export const maxDuration = 30;

const CACHE_TTL_MS = 15 * 60 * 1000;
const cache = new Map<string, { payload: unknown; expiresAt: number }>();

function readCache(key: string) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    cache.delete(key);
    return null;
  }
  return entry.payload;
}

function writeCache(key: string, payload: unknown) {
  if (cache.size > 500) cache.clear();
  cache.set(key, { payload, expiresAt: Date.now() + CACHE_TTL_MS });
}

// Coordinates arrive rounded from the client and are rounded again here:
// ~1.1 km is plenty for weather, and precision is never forwarded to MET Norway.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const lat = parseCoordinate(url.searchParams.get('lat'));
  const lon = parseCoordinate(url.searchParams.get('lon'));

  if (lat === null || lon === null || !isValidCoordinate(lat, lon)) {
    return NextResponse.json(
      { error: 'Ógild hnít. Bongómælirinn þarf gildar breiddar- og lengdargráður.' },
      { status: 400, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  const point = roundLocation({ lat, lon });
  const cacheKey = `${point.lat},${point.lon}`;
  const cached = readCache(cacheKey);
  if (cached) {
    return NextResponse.json(cached, { headers: cacheHeaders() });
  }

  const place = describePlace(point, locations);
  const now = new Date();

  try {
    const { snapshot, timeline } = await fetchMetNoLocation(
      { id: 'you', name: place.name, lat: point.lat, lon: point.lon },
      { now },
    );
    const payload = assembleBongoPayload({ name: place.name, lat: point.lat, lon: point.lon }, { snapshot, timeline }, { now });
    writeCache(cacheKey, payload);
    return NextResponse.json(payload, { headers: cacheHeaders() });
  } catch {
    // MET Norway is down: fall back to the nearest station's mock snapshot so
    // the meter still answers, clearly labelled as degraded.
    const nearest = nearestKnownLocation(point, locations);
    if (!nearest) {
      return NextResponse.json({ error: 'Veðurþjónusta svarar ekki.' }, { status: 502 });
    }
    const fallbackSnapshot = mockWeatherByLocationId[nearest.location.id];
    const payload = {
      ...assembleBongoPayload(
        { name: `${place.name} (varaleið)`, lat: point.lat, lon: point.lon },
        { snapshot: fallbackSnapshot, timeline: [] },
        { now },
      ),
      degraded: true,
    };
    return NextResponse.json(payload, { headers: { 'Cache-Control': 'no-store' } });
  }
}

function cacheHeaders() {
  return { 'Cache-Control': 'public, max-age=30, s-maxage=900, stale-while-revalidate=300' };
}
