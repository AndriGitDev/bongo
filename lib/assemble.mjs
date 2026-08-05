import { findBestAnswerWindow, formatWindowMessage, scoreBongo, scoreTimeline } from './scoring.mjs';

// Visual mood for the ambient hero: rain beats wind beats dark beats sun.
export function moodFromSnapshot(snapshot) {
  if (snapshot.precipitationMm >= 0.5 || snapshot.cloudCoverPct >= 85) return 'rain';
  if (snapshot.windMs >= 9 || snapshot.gustMs >= 15) return 'wind';
  if (!snapshot.daylight) return 'night';
  if (snapshot.cloudCoverPct <= 30) return 'sun';
  return 'fair';
}

// One canonical shape for a bongó reading, used by the server page, the
// /api/bongo route and the client island. `place` is any {name, lat, lon}.
export function assembleBongoPayload(place, { snapshot, timeline }, { now = new Date() } = {}) {
  const scored = scoreBongo(place, snapshot);
  const scoredTimeline = scoreTimeline(timeline ?? []);
  const window = findBestAnswerWindow(scoredTimeline);

  return {
    place: { name: place.name, lat: place.lat, lon: place.lon, id: place.id ?? null },
    score: scored.score,
    label: scored.label,
    explanation: scored.explanation,
    factors: scored.factors,
    observedAt: scored.observedAt ?? null,
    source: scored.source ?? 'mock',
    providerUpdatedAt: scored.providerUpdatedAt ?? null,
    timeline: scoredTimeline,
    window,
    windowMessage: formatWindowMessage(window, now),
    mood: moodFromSnapshot(snapshot),
  };
}
