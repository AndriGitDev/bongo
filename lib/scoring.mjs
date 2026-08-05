import { distanceKm } from './geo.mjs';
import { daylightTier } from './solar.mjs';

export const WEIGHTS = {
  sun: 0.35,
  wind: 0.3,
  temperature: 0.2,
  precipitation: 0.1,
  daylight: 0.05,
};

export function clamp(value, min = 0, max = 100) {
  return Math.min(max, Math.max(min, value));
}

export function getBongoLabel(score) {
  if (score >= 90) return 'Bongó';
  if (score >= 75) return 'Bongólegt';
  if (score >= 60) return 'Næstum bongó';
  if (score >= 40) return 'Gluggaveður';
  if (score >= 20) return 'Ekki bongó';
  return 'Farðu inn';
}

function scoreSun(cloudCoverPct) {
  return clamp(100 - cloudCoverPct * 1.05);
}

function scoreWind(windMs, gustMs) {
  const steadyPenalty = windMs <= 2 ? 0 : (windMs - 2) * 9;
  const gustPenalty = gustMs <= 5 ? 0 : (gustMs - 5) * 3.2;
  return clamp(100 - steadyPenalty - gustPenalty);
}

function scoreTemperature(temperatureC) {
  if (temperatureC >= 12 && temperatureC <= 20) return 100;
  if (temperatureC > 20 && temperatureC <= 24) return 92;
  if (temperatureC >= 9 && temperatureC < 12) return 75 + (temperatureC - 9) * 8;
  if (temperatureC >= 5 && temperatureC < 9) return 38 + (temperatureC - 5) * 9;
  if (temperatureC > 24) return clamp(92 - (temperatureC - 24) * 7);
  return clamp(38 + temperatureC * 5);
}

function scorePrecipitation(precipitationMm) {
  if (precipitationMm <= 0) return 100;
  if (precipitationMm <= 0.2) return 82;
  if (precipitationMm <= 1) return 55;
  return clamp(35 - (precipitationMm - 1) * 9);
}

function daylightFactor(snapshot) {
  if (typeof snapshot.sunElevationDeg === 'number' && Number.isFinite(snapshot.sunElevationDeg)) {
    const tier = daylightTier(snapshot.sunElevationDeg);
    return { value: tier.label, score: tier.score };
  }
  // Mock snapshots carry a simple boolean instead of a sun elevation.
  return snapshot.daylight ? { value: 'bjart', score: 100 } : { value: 'dimmt', score: 12 };
}

function buildFactors(snapshot) {
  const daylight = daylightFactor(snapshot);
  return {
    sun: {
      label: 'Sól',
      value: `${Math.round(100 - snapshot.cloudCoverPct)}% sól`,
      score: Math.round(scoreSun(snapshot.cloudCoverPct)),
      weight: WEIGHTS.sun,
    },
    wind: {
      label: 'Vindur',
      value: `${snapshot.windMs} m/s · hviður ${snapshot.gustMs} m/s`,
      score: Math.round(scoreWind(snapshot.windMs, snapshot.gustMs)),
      weight: WEIGHTS.wind,
    },
    temperature: {
      label: 'Hiti',
      value: `${snapshot.temperatureC}°C`,
      score: Math.round(scoreTemperature(snapshot.temperatureC)),
      weight: WEIGHTS.temperature,
    },
    precipitation: {
      label: 'Teppið',
      value: snapshot.precipitationMm === 0 ? 'þurrt' : `${snapshot.precipitationMm} mm úrkoma`,
      score: Math.round(scorePrecipitation(snapshot.precipitationMm)),
      weight: WEIGHTS.precipitation,
    },
    daylight: {
      label: 'Dagsbirta',
      value: daylight.value,
      score: daylight.score,
      weight: WEIGHTS.daylight,
    },
  };
}

function applyCaps(score, snapshot) {
  let capped = score;
  // Icelandic realism: bright but windy weather looks good through glass but is not blanket weather.
  if (snapshot.cloudCoverPct <= 25 && (snapshot.windMs >= 9 || snapshot.gustMs >= 15)) {
    capped = Math.min(capped, 58);
  }
  if (snapshot.precipitationMm >= 2 || (snapshot.precipitationMm >= 1 && snapshot.cloudCoverPct >= 75)) {
    capped = Math.min(capped, 35);
  }
  return capped;
}

// Location-free scoring core, shared by the live card and the hourly timeline.
export function scoreSnapshotCore(snapshot) {
  const factors = buildFactors(snapshot);
  const raw = Object.values(factors).reduce((sum, factor) => sum + factor.score * factor.weight, 0);
  const score = Math.round(clamp(applyCaps(raw, snapshot)));
  return { score, label: getBongoLabel(score), factors };
}

export function scoreBongo(location, snapshot) {
  const core = scoreSnapshotCore(snapshot);
  return {
    location,
    score: core.score,
    label: core.label,
    factors: core.factors,
    explanation: explain(location.name, snapshot, core.score, core.label),
    observedAt: snapshot.observedAt,
    source: snapshot.source,
    providerUpdatedAt: snapshot.providerUpdatedAt,
  };
}

function explain(name, snapshot, score, label) {
  if (label === 'Bongó') {
    return `${name} er í hreinu bongói: sól, logn, þurrt teppi og ${snapshot.temperatureC}°C. Þetta er sjaldgæf íslensk yfirlýsing.`;
  }
  if (label === 'Bongólegt') {
    return `${name} er bongólegt. Sól og þurrt veður gera sitt, jafnvel þó íslenska sumarið sé enn í lopapeysu.`;
  }
  if (label === 'Næstum bongó') {
    return `${name} er næstum bongó. Það vantar aðeins meiri sól, meiri hita eða minni vind til að teppið fái formlegt samþykki.`;
  }
  if (label === 'Gluggaveður') {
    if (snapshot.windMs >= 9 || snapshot.gustMs >= 15) {
      return `${name} er gluggaveður: sólin er til staðar, en það er of hvasst fyrir teppi. Þetta lítur betur út út um gluggann.`;
    }
    return `${name} er gluggaveður. Kannski fínt í göngutúr, en Bongómælirinn er ekki sannfærður.`;
  }
  if (label === 'Ekki bongó') {
    if (snapshot.precipitationMm > 0) return `${name} er ekki bongó. Blautt teppi er ekki stemning, sama hvað hitamælirinn reynir að segja.`;
    return `${name} er ekki bongó í augnablikinu. Of kalt, of skýjað eða of hvasst fyrir alvöru útiveru.`;
  }
  return `${name}: farðu inn. Bongómælirinn leggur til heitt kaffi og endurmat síðar.`;
}

export function rankLocations(locations, snapshotsByLocationId, limit = 5) {
  return locations
    .map((location) => scoreBongo(location, snapshotsByLocationId[location.id]))
    .sort((a, b) => b.score - a.score || a.location.name.localeCompare(b.location.name, 'is'))
    .slice(0, limit);
}

export function nearestBetterLocations(currentLocation, scoredLocations, currentScore, limit = 3) {
  return scoredLocations
    .filter((entry) => entry.location.id !== currentLocation.id && entry.score > currentScore)
    .map((entry) => ({ ...entry, distanceKm: Math.round(distanceKm(currentLocation, entry.location)) }))
    .sort((a, b) => a.distanceKm - b.distanceKm || b.score - a.score || a.location.name.localeCompare(b.location.name, 'is'))
    .slice(0, limit);
}

// --- Hourly timeline scoring -------------------------------------------------

export function scoreTimeline(instants) {
  return instants.map((instant) => {
    const core = scoreSnapshotCore(instant);
    return {
      time: instant.observedAt,
      score: core.score,
      label: core.label,
      temperatureC: instant.temperatureC,
      windMs: instant.windMs,
      cloudCoverPct: instant.cloudCoverPct,
      precipitationMm: instant.precipitationMm,
      daylight: core.factors.daylight.value,
    };
  });
}

// Finds the first contiguous run at or above `threshold` inside the horizon.
// Timeline entries are timestamped, so a run's duration follows real gaps
// (hourly cells are 1h; sparse 6h cells simply stretch the run).
export function findNextBongoWindow(timeline, { threshold = 75, horizonHours = 48 } = {}) {
  if (!Array.isArray(timeline) || timeline.length === 0) return null;
  const startMs = Date.parse(timeline[0].time);
  if (Number.isNaN(startMs)) return null;
  const horizonEndMs = startMs + horizonHours * 3600000;

  let run = null;
  for (let i = 0; i < timeline.length; i += 1) {
    const entryMs = Date.parse(timeline[i].time);
    if (Number.isNaN(entryMs) || entryMs >= horizonEndMs) break;
    if (timeline[i].score >= threshold) {
      if (!run) {
        run = { startIndex: i, startTime: timeline[i].time, bestScore: timeline[i].score };
      } else {
        run.bestScore = Math.max(run.bestScore, timeline[i].score);
      }
      const next = timeline[i + 1];
      const endMs = next ? Date.parse(next.time) : entryMs + 3600000;
      run.endTime = new Date(endMs).toISOString();
      run.endIndex = i;
    } else if (run) {
      return { ...run, threshold, hours: round1((Date.parse(run.endTime) - Date.parse(run.startTime)) / 3600000) };
    }
  }
  if (!run) return null;
  return { ...run, threshold, hours: round1((Date.parse(run.endTime) - Date.parse(run.startTime)) / 3600000) };
}

// Reports the first solid bongó window, or falls back to "næstum bongó" so the
// forecast never ends without an answer.
export function findBestAnswerWindow(timeline) {
  return findNextBongoWindow(timeline, { threshold: 75 }) ?? findNextBongoWindow(timeline, { threshold: 60 });
}

function round1(value) {
  return Math.round(value * 10) / 10;
}

function zonedDateString(date, timeZone) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function zonedTimeString(date, timeZone) {
  return new Intl.DateTimeFormat('is-IS', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(date);
}

const WEEKDAY_DATIVE = {
  sunnudagur: 'sunnudegi',
  mánudagur: 'mánudegi',
  þriðjudagur: 'þriðjudegi',
  miðvikudagur: 'miðvikudegi',
  fimmtudagur: 'fimmtudegi',
  föstudagur: 'föstudegi',
  laugardagur: 'laugardegi',
};

export function formatWindowMessage(window, now, timeZone = 'Atlantic/Reykjavik') {
  if (!window) return 'Ekkert bongó spáð næstu 48 klukkustundir — fylgstu með glugganum.';
  const start = new Date(window.startTime);
  const end = window.endTime ? new Date(window.endTime) : null;
  const prefix = window.threshold >= 75 ? 'Næsta bongó' : 'Næstum bongó';

  if (end && start.getTime() - now.getTime() < 3600000) {
    return `${prefix}: núna, fram til kl. ${zonedTimeString(end, timeZone)}.`;
  }
  const startDay = zonedDateString(start, timeZone);
  const range = end ? `kl. ${zonedTimeString(start, timeZone)}–${zonedTimeString(end, timeZone)}` : `kl. ${zonedTimeString(start, timeZone)}`;
  if (startDay === zonedDateString(now, timeZone)) {
    return `${prefix}: í dag, ${range}.`;
  }
  const tomorrow = new Date(now.getTime() + 86400000);
  if (startDay === zonedDateString(tomorrow, timeZone)) {
    return `${prefix}: á morgun, ${range}.`;
  }
  const weekdayNominative = new Intl.DateTimeFormat('is-IS', { timeZone, weekday: 'long' }).format(start);
  const weekday = WEEKDAY_DATIVE[weekdayNominative] ?? weekdayNominative;
  return `${prefix}: á ${weekday}, ${range}.`;
}
