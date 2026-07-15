// Shared local-timezone date helpers.
//
// The app's "briefing day" concept is a LOCAL calendar day: "today's
// briefing" should mean today on the user's wall clock. The old idiom
// `new Date().toISOString().slice(0, 10)` (and its local-midnight →
// toISOString variant) converts through UTC, so in UTC+ timezones it
// returns yesterday's date until UTC catches up — mislabeling "Today"
// in the sidebar and stamping feedback with the wrong day.
//
// Stored format is unchanged: plain `YYYY-MM-DD`.

/**
 * Format a Date as `YYYY-MM-DD` in the LOCAL timezone.
 * @param {Date} [d] defaults to now
 * @returns {string}
 */
export function localDateStr(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
