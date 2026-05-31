const WEIGHTS = {
  sun: 0.35,
  wind: 0.30,
  temperature: 0.20,
  precipitation: 0.10,
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

export function scoreBongo(location, snapshot) {
  const factors = {
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
      value: snapshot.daylight ? 'bjart' : 'dimmt',
      score: snapshot.daylight ? 100 : 15,
      weight: WEIGHTS.daylight,
    },
  };

  const raw = Object.values(factors).reduce((sum, factor) => sum + factor.score * factor.weight, 0);
  let score = Math.round(clamp(raw));

  // Icelandic realism: bright but windy weather looks good through glass but is not blanket weather.
  if (snapshot.cloudCoverPct <= 25 && (snapshot.windMs >= 9 || snapshot.gustMs >= 15)) {
    score = Math.min(score, 58);
  }
  if (snapshot.precipitationMm >= 2 || (snapshot.precipitationMm >= 1 && snapshot.cloudCoverPct >= 75)) {
    score = Math.min(score, 35);
  }

  const label = getBongoLabel(score);
  return {
    location,
    score,
    label,
    factors,
    explanation: explain(location.name, snapshot, score, label),
    observedAt: snapshot.observedAt,
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

function distanceKm(a, b) {
  const radius = 6371;
  const toRad = (degrees) => (degrees * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * radius * Math.asin(Math.sqrt(h));
}

export function nearestBetterLocations(currentLocation, scoredLocations, currentScore, limit = 3) {
  return scoredLocations
    .filter((entry) => entry.location.id !== currentLocation.id && entry.score > currentScore)
    .map((entry) => ({ ...entry, distanceKm: Math.round(distanceKm(currentLocation, entry.location)) }))
    .sort((a, b) => a.distanceKm - b.distanceKm || b.score - a.score || a.location.name.localeCompare(b.location.name, 'is'))
    .slice(0, limit);
}
