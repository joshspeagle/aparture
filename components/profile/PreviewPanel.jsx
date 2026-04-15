import { useMemo } from 'react';

const LAST_RUN_KEY = 'aparture-last-analysis-run';

export function selectPreviewSample(papers) {
  const sorted = [...papers].sort((a, b) => b.score - a.score);
  const top10 = sorted.slice(0, 10);
  const borderline = sorted
    .filter((p) => p.score >= 5.0 && p.score < 7.0 && !top10.includes(p))
    .slice(0, 5);
  return [...top10, ...borderline];
}

function readLastRun() {
  if (typeof window === 'undefined') return null;
  const stored = window.localStorage.getItem(LAST_RUN_KEY);
  if (!stored) return null;
  try {
    const parsed = JSON.parse(stored);
    if (!parsed?.papers || !Array.isArray(parsed.papers) || parsed.papers.length === 0) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

// eslint-disable-next-line no-unused-vars
export default function PreviewPanel({ editedProfile, models, password, onClose }) {
  const lastRun = useMemo(() => readLastRun(), []);
  const sample = useMemo(() => (lastRun ? selectPreviewSample(lastRun.papers) : []), [lastRun]);

  return (
    <section className="rounded-lg border border-slate-700 bg-slate-950/60 p-4 mt-3">
      <header className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-slate-200">Preview — profile changes</h3>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close preview"
          className="text-slate-400 hover:text-slate-100 text-lg leading-none"
        >
          ×
        </button>
      </header>

      {!lastRun ? (
        <p className="text-xs text-slate-400">
          No recent analysis to preview against. Run a full analysis first.
        </p>
      ) : (
        <div>
          <p className="text-xs text-slate-400 mb-3">
            Will run filter + scoring + synthesis on {sample.length} cached papers (top 10 + up to 5
            borderline).
          </p>
          <button
            type="button"
            title="~$0.15–0.30 per run · ~45–90s"
            className="bg-red-600 hover:bg-red-500 text-white px-4 py-2 rounded-md text-sm font-medium"
          >
            Run preview
          </button>
        </div>
      )}
    </section>
  );
}
