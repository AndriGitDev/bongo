import test from 'node:test';
import assert from 'node:assert/strict';
import { formatDateTime, formatHour, zonedDay } from '../lib/time.mjs';

test('Icelandic timestamps do not depend on the available Intl locale data', () => {
  assert.equal(formatDateTime('2026-10-13T19:20:00Z'), '13.10.2026, 19:20');
  assert.equal(formatDateTime(null), 'óþekkt');
});

test('forecast labels use Iceland UTC across midnight and explicit offsets', () => {
  assert.equal(formatHour('2026-10-14T01:05:00+02:00'), '23:05');
  assert.equal(zonedDay('2026-10-14T01:05:00+02:00'), '2026-10-13');
  assert.equal(formatHour('2026-10-14T00:05:00Z'), '00:05');
});
