// Work log for the weekly report ("what we did this week / last week").
// Append an entry whenever something ships. Dates are ISO (YYYY-MM-DD).
// The /dashboard page groups these by week; the Monday Discord report
// includes the current and previous week's entries automatically.
import generatedRaw from './updates.generated.json';

export interface Update {
  date: string; // YYYY-MM-DD
  text: string;
}

export const updates: Update[] = [];

const generated: Update[] = (generatedRaw as Update[]).filter(
  (g) => !updates.some((u) => u.date === g.date && u.text === g.text),
);

/** Static + git-generated entries, newest first. */
export const allStaticUpdates: Update[] = [...updates, ...generated].sort((a, b) =>
  a.date < b.date ? 1 : -1,
);

/** Entries (plus any extra, e.g. dashboard-logged) inside [start, end). */
export function updatesBetween(start: Date, end: Date, extra: Update[] = []): Update[] {
  const seen = new Set<string>();
  return [...extra, ...allStaticUpdates]
    .filter((u) => {
      const k = u.date + '|' + u.text;
      if (seen.has(k)) return false;
      seen.add(k);
      const d = new Date(u.date + 'T12:00:00Z');
      return d >= start && d < end;
    })
    .sort((a, b) => (a.date < b.date ? 1 : -1));
}
