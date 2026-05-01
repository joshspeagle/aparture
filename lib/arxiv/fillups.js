// Per-subcategory lookback-extension logic. Pure: caller injects fetchFn.
// Spec §4.2 + §4.3.

import { narrowSetOf } from './sets.js';

function isoDate(d) {
  return d.toISOString().split('T')[0];
}

function shiftDays(yyyymmdd, days) {
  const d = new Date(`${yyyymmdd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return isoDate(d);
}

/**
 * @returns {Array<{extraDays: number, from: string, until: string}>}
 */
export function planFillupSteps({ from, until, schedule }) {
  if (!Array.isArray(schedule) || schedule.length === 0) return [];
  const steps = [];
  let prevExtraDays = 0;
  for (const extraDays of schedule) {
    const stepUntil = shiftDays(from, -prevExtraDays - 1);
    const stepFrom = shiftDays(from, -extraDays);
    steps.push({ extraDays, from: stepFrom, until: stepUntil });
    prevExtraDays = extraDays;
  }
  return steps;
}

function bucketBySubcategory(papers, selectedSubcategories) {
  const counts = Object.fromEntries(selectedSubcategories.map((s) => [s, 0]));
  for (const p of papers) {
    if (counts[p.fetchedCategory] !== undefined) counts[p.fetchedCategory] += 1;
  }
  return counts;
}

/**
 * @param {Object} args
 * @param {Array} args.papers                    Papers from broad fetches (already filtered + attributed)
 * @param {string[]} args.selectedSubcategories
 * @param {number[]} args.schedule
 * @param {number} args.threshold
 * @param {string} args.from
 * @param {string} args.until
 * @param {Function} args.fetchFn                async ({narrowSet, from, until, subcategory}) => Paper[]
 * @returns {Promise<{papers, fillups}>}
 */
export async function applyFillups({
  papers,
  selectedSubcategories,
  schedule,
  threshold,
  from,
  until,
  fetchFn,
}) {
  const fillups = [];
  if (threshold <= 0 || schedule.length === 0) {
    return { papers, fillups };
  }

  const counts = bucketBySubcategory(papers, selectedSubcategories);
  const steps = planFillupSteps({ from, until, schedule });

  const merged = [...papers];

  for (const subcategory of selectedSubcategories) {
    if (counts[subcategory] >= threshold) continue;
    const triggeredAt = counts[subcategory];
    const narrowSet = narrowSetOf(subcategory);
    if (!narrowSet) continue;

    let stepsUsed = 0;
    let currentCount = triggeredAt;
    for (const step of steps) {
      stepsUsed += 1;
      const fetched = await fetchFn({
        narrowSet,
        from: step.from,
        until: step.until,
        subcategory,
      });
      // Attribute fetchedCategory + add to merged set.
      for (const p of fetched) {
        const withCategory = { ...p, fetchedCategory: subcategory };
        merged.push(withCategory);
        currentCount += 1;
      }
      if (currentCount >= threshold) break;
    }
    fillups.push({ subcategory, triggeredAt, finalCount: currentCount, stepsUsed });
  }

  return { papers: merged, fillups };
}
