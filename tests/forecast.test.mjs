import test from 'node:test';
import assert from 'node:assert/strict';

import {
  findNextBongoWindow,
  findBestAnswerWindow,
  formatWindowMessage,
  scoreTimeline,
} from '../lib/scoring.mjs';

function hourlyTimeline(pattern, startTime = '2026-06-05T10:00:00Z') {
  const startMs = Date.parse(startTime);
  return pattern.map((score, index) => ({
    time: new Date(startMs + index * 3600000).toISOString(),
    score,
  }));
}

test('findNextBongoWindow finds the first run at or above the threshold', () => {
  const timeline = hourlyTimeline([20, 30, 80, 85, 78, 40, 90]);

  const window = findNextBongoWindow(timeline, { threshold: 75 });

  assert.equal(window.startTime, '2026-06-05T12:00:00.000Z');
  assert.equal(window.endTime, '2026-06-05T15:00:00.000Z');
  assert.equal(window.hours, 3);
  assert.equal(window.bestScore, 85);
});

test('findNextBongoWindow ignores runs beyond the horizon', () => {
  const timeline = hourlyTimeline([...new Array(49).fill(10), 95]);

  assert.equal(findNextBongoWindow(timeline, { horizonHours: 48 }), null);
});

test('findNextBongoWindow returns null on empty or hopeless timelines', () => {
  assert.equal(findNextBongoWindow([]), null);
  assert.equal(findNextBongoWindow(hourlyTimeline([10, 20, 30])), null);
});

test('findBestAnswerWindow falls back to the næstum bongó threshold', () => {
  const timeline = hourlyTimeline([10, 62, 66, 20]);

  const window = findBestAnswerWindow(timeline);

  assert.equal(window.threshold, 60);
  assert.equal(window.hours, 2);
});

test('findBestAnswerWindow prefers a real bongó window over the fallback', () => {
  const timeline = hourlyTimeline([10, 62, 80, 82, 20]);

  const window = findBestAnswerWindow(timeline);

  assert.equal(window.threshold, 75);
  assert.equal(window.startTime, '2026-06-05T12:00:00.000Z');
});

test('scoreTimeline scores raw instants with the full engine', () => {
  const instants = [
    {
      observedAt: '2026-06-05T12:00:00Z',
      temperatureC: 14,
      windMs: 2,
      gustMs: 4,
      precipitationMm: 0,
      cloudCoverPct: 10,
      sunElevationDeg: 30,
      daylight: true,
    },
    {
      observedAt: '2026-06-05T13:00:00Z',
      temperatureC: 13,
      windMs: 12,
      gustMs: 20,
      precipitationMm: 2.5,
      cloudCoverPct: 90,
      sunElevationDeg: 28,
      daylight: true,
    },
  ];

  const [good, bad] = scoreTimeline(instants);

  assert.equal(good.time, '2026-06-05T12:00:00Z');
  assert.ok(good.score >= 75, `expected bongólegt hour, got ${good.score}`);
  assert.ok(bad.score <= 35, `rain cap should apply, got ${bad.score}`);
  assert.equal(bad.label, 'Ekki bongó');
  assert.equal(good.daylight, 'bjart');
});

test('formatWindowMessage describes today, tomorrow, weekdays and now', () => {
  const now = new Date('2026-06-05T10:00:00Z'); // Friday.

  const today = { startTime: '2026-06-05T14:00:00Z', endTime: '2026-06-05T17:00:00Z', threshold: 75 };
  const todayMessage = formatWindowMessage(today, now);
  assert.match(todayMessage, /í dag/);
  assert.match(todayMessage, /14:00/);
  assert.match(todayMessage, /17:00/);

  const tomorrow = { startTime: '2026-06-06T08:00:00Z', endTime: '2026-06-06T10:00:00Z', threshold: 75 };
  assert.match(formatWindowMessage(tomorrow, now), /á morgun/);

  // 2026-06-08 is a Monday: the message must use the dative "mánudegi".
  const monday = { startTime: '2026-06-08T09:00:00Z', endTime: '2026-06-08T12:00:00Z', threshold: 75 };
  assert.match(formatWindowMessage(monday, now), /á mánudegi/);

  const rightNow = { startTime: '2026-06-05T10:15:00Z', endTime: '2026-06-05T13:00:00Z', threshold: 75 };
  assert.match(formatWindowMessage(rightNow, now), /núna/);

  const fallback = { startTime: '2026-06-05T14:00:00Z', endTime: '2026-06-05T15:00:00Z', threshold: 60 };
  assert.match(formatWindowMessage(fallback, now), /^Næstum bongó/);

  assert.match(formatWindowMessage(null, now), /Ekkert bongó/);
});
