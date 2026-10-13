// Iceland observes UTC throughout the year. Fixed formatting keeps server
// and browser markup identical even when the browser lacks Icelandic ICU data.
const pad = (value) => String(value).padStart(2, '0');

export function formatDateTime(value) {
  if (!value) return 'óþekkt';
  const date = new Date(value);
  return `${date.getUTCDate()}.${date.getUTCMonth() + 1}.${date.getUTCFullYear()}, ${formatHour(value)}`;
}

export function formatHour(value) {
  const date = new Date(value);
  return `${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}`;
}

export function zonedDay(value) {
  return new Date(value).toISOString().slice(0, 10);
}
