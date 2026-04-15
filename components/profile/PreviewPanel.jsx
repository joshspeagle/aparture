import { useMemo, useState } from 'react';
import { MODEL_REGISTRY } from '../../utils/models.js';
import BriefingView from '../briefing/BriefingView.jsx';

const LAST_RUN_KEY = 'aparture-last-analysis-run';

export function selectPreviewSample(papers) {
  const sorted = [...papers].sort((a, b) => b.score - a.score);
  const top10 = sorted.slice(0, 10);
  const borderline = sorted
    .filter((p) => p.score >= 5.0 && p.score < 7.0 && !top10.includes(p))
    .slice(0, 5);
  return [...top10, ...borderline];
}

export function computeRankShifts(originalSample, reScored) {
  const originalRankById = new Map();
  [...originalSample]
    .sort((a, b) => b.score - a.score)
    .forEach((p, i) => originalRankById.set(p.arxivId, i + 1));
  return reScored.map((p, i) => {
    const rankBefore = originalRankById.get(p.arxivId) ?? null;
    const rankAfter = i + 1;
    const delta = rankBefore !== null ? rankBefore - rankAfter : 0;
    return {
      arxivId: p.arxivId,
      title: p.title,
      oldScore: p.score,
      newScore: p.newScore,
      rankBefore,
      rankAfter,
      delta,
    };
  });
}

function FilterChangesSection({ verdicts, originalSample }) {
  const dropped = (verdicts ?? [])
    .filter((v) => v.verdict === 'NO')
    .map((v) => originalSample[v.paperIndex - 1])
    .filter(Boolean);

  return (
    <div className="rounded-md border border-slate-700 bg-slate-900/40 p-3">
      <h4 className="text-sm font-semibold text-slate-200 mb-2">
        {dropped.length} {dropped.length === 1 ? 'paper' : 'papers'} would be filtered out
      </h4>
      {dropped.length === 0 ? (
        <p className="text-xs text-slate-500 italic">No papers dropped by filter</p>
      ) : (
        <ul className="text-xs text-slate-300 space-y-1 list-disc list-inside">
          {dropped.map((p) => (
            <li key={p.arxivId}>{p.title}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ScoringShiftsSection({ shifts }) {
  if (!shifts || shifts.length === 0) {
    return (
      <div className="rounded-md border border-slate-700 bg-slate-900/40 p-3">
        <h4 className="text-sm font-semibold text-slate-200 mb-2">Scoring shifts</h4>
        <p className="text-xs text-slate-500 italic">No papers scored — all were filtered out.</p>
      </div>
    );
  }

  return (
    <div className="rounded-md border border-slate-700 bg-slate-900/40 p-3">
      <h4 className="text-sm font-semibold text-slate-200 mb-2">Scoring shifts</h4>
      <div className="overflow-x-auto">
        <table className="w-full text-xs text-slate-200">
          <thead>
            <tr className="text-left text-slate-400 border-b border-slate-700">
              <th className="py-1 pr-2">Rank before</th>
              <th className="py-1 pr-2">Title</th>
              <th className="py-1 pr-2">Old score</th>
              <th className="py-1 pr-2">New score</th>
              <th className="py-1 pr-2">Rank after</th>
              <th className="py-1 pr-2">Δ</th>
            </tr>
          </thead>
          <tbody>
            {shifts.map((s) => {
              let rowClass = '';
              if (s.delta > 0) rowClass = 'bg-green-900/30';
              else if (s.delta < 0) rowClass = 'bg-red-900/30';
              const deltaStr = s.delta > 0 ? `+${s.delta}` : `${s.delta}`;
              return (
                <tr key={s.arxivId} className={`border-b border-slate-800 ${rowClass}`}>
                  <td className="py-1 pr-2">{s.rankBefore ?? '—'}</td>
                  <td className="py-1 pr-2">{s.title}</td>
                  <td className="py-1 pr-2">
                    {typeof s.oldScore === 'number' ? s.oldScore.toFixed(1) : '—'}
                  </td>
                  <td className="py-1 pr-2">
                    {typeof s.newScore === 'number' ? s.newScore.toFixed(1) : '—'}
                  </td>
                  <td className="py-1 pr-2">{s.rankAfter}</td>
                  <td className="py-1 pr-2">{deltaStr}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function MiniBriefingSection({ briefing }) {
  if (!briefing) return null;
  const noop = () => {};
  return (
    <div className="rounded-md border border-dashed border-amber-600 bg-amber-950/20 p-3">
      <div className="text-xs font-semibold uppercase tracking-wide text-amber-400 mb-2">
        Preview — not saved
      </div>
      <div className="bg-slate-950/40 rounded p-3">
        <BriefingView
          briefing={briefing}
          date="preview"
          papersScreened={briefing.papers?.length ?? 0}
          quickSummariesById={{}}
          fullReportsById={{}}
          onStar={noop}
          onDismiss={noop}
          onSkipQuestion={noop}
          onPreviewProfileUpdate={noop}
        />
      </div>
    </div>
  );
}

function deriveProvider(modelId) {
  const cfg = MODEL_REGISTRY[modelId];
  const raw = cfg?.provider ?? 'Google';
  return raw.toLowerCase();
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

export default function PreviewPanel({ editedProfile, models, password, onClose }) {
  const lastRun = useMemo(() => readLastRun(), []);
  const sample = useMemo(() => (lastRun ? selectPreviewSample(lastRun.papers) : []), [lastRun]);

  const [runState, setRunState] = useState('idle');
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  async function runPreview() {
    try {
      setError(null);
      setResult(null);
      setRunState('running-filter');

      // Step 1: Quick filter
      const filterRes = await fetch('/api/quick-filter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          papers: sample.map((p) => ({
            arxivId: p.arxivId,
            title: p.title,
            abstract: p.abstract,
          })),
          scoringCriteria: editedProfile,
          password,
          model: models.filter,
        }),
      });
      if (!filterRes.ok) throw new Error(`Filter stage failed: ${filterRes.status}`);
      const filterResult = await filterRes.json();

      // Survivors: YES + MAYBE (drop NO). API returns { verdicts: [{ paperIndex, verdict }] }
      // paperIndex is 1-based and corresponds to the order of `sample`.
      const verdictsArray = Array.isArray(filterResult.verdicts) ? filterResult.verdicts : [];
      const survivorIdx = new Set(
        verdictsArray.filter((v) => v.verdict !== 'NO').map((v) => v.paperIndex - 1)
      );
      const survivors = sample.filter((_, idx) => survivorIdx.has(idx));

      setRunState('running-score');

      // Step 2: Scoring
      const scoreRes = await fetch('/api/score-abstracts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          papers: survivors.map((p) => ({
            arxivId: p.arxivId,
            title: p.title,
            abstract: p.abstract,
          })),
          scoringCriteria: editedProfile,
          password,
          model: models.scoring,
        }),
      });
      if (!scoreRes.ok) throw new Error(`Scoring stage failed: ${scoreRes.status}`);
      const scoreResult = await scoreRes.json();

      // Merge new scores back into the survivors via paperIndex (1-based).
      const scoresArray = Array.isArray(scoreResult.scores) ? scoreResult.scores : [];
      const reScored = scoresArray
        .map((s) => {
          const survivor = survivors[s.paperIndex - 1];
          if (!survivor) return null;
          return {
            ...survivor,
            newScore: s.score,
            newJustification: s.justification,
          };
        })
        .filter((p) => p && p.newScore !== undefined)
        .sort((a, b) => b.newScore - a.newScore);

      const top10OfReScored = reScored.slice(0, 10);

      setRunState('running-synth');

      // Step 3: Synthesis
      const synthRes = await fetch('/api/synthesize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profile: editedProfile,
          papers: top10OfReScored.map((p) => ({
            arxivId: p.arxivId,
            title: p.title,
            abstract: p.abstract,
            score: p.newScore,
            scoringJustification: p.newJustification,
            fullReport: p.fullReport,
          })),
          history: [],
          password,
          provider: deriveProvider(models.briefing),
          model: models.briefing,
        }),
      });
      if (!synthRes.ok) throw new Error(`Synthesis stage failed: ${synthRes.status}`);
      const synthResult = await synthRes.json();

      setResult({
        filterResult,
        scoreResult,
        synthResult,
        reScored,
        originalSample: sample,
      });
      setRunState('done');
    } catch (e) {
      setError(e.message);
      setRunState('error');
    }
  }

  const stageLabel = {
    'running-filter': 'Running filter…',
    'running-score': 'Running scoring…',
    'running-synth': 'Running synthesis…',
  };

  const isRunning =
    runState === 'running-filter' || runState === 'running-score' || runState === 'running-synth';

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
          {runState === 'idle' && (
            <>
              <p className="text-xs text-slate-400 mb-3">
                Will run filter + scoring + synthesis on {sample.length} cached papers (top 10 + up
                to 5 borderline).
              </p>
              <button
                type="button"
                onClick={runPreview}
                title="~$0.15–0.30 per run · ~45–90s"
                className="bg-red-600 hover:bg-red-500 text-white px-4 py-2 rounded-md text-sm font-medium"
              >
                Run preview
              </button>
            </>
          )}

          {isRunning && (
            <div className="flex items-center gap-2 text-sm text-slate-300">
              <span
                aria-hidden="true"
                className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-slate-500 border-t-slate-200"
              />
              <span>{stageLabel[runState]}</span>
            </div>
          )}

          {runState === 'done' && result && (
            <div className="text-sm text-slate-200">
              <p className="mb-3">
                Preview complete. {result.reScored.length} papers kept by filter
                {result.reScored.length > 0 && (
                  <>
                    {', top paper now scoring '}
                    {result.reScored[0].newScore.toFixed(1)}
                  </>
                )}
                .
              </p>
              <div className="mt-4 space-y-6">
                <FilterChangesSection
                  verdicts={result.filterResult.verdicts}
                  originalSample={result.originalSample}
                />
                <ScoringShiftsSection
                  shifts={computeRankShifts(result.originalSample, result.reScored)}
                />
                <MiniBriefingSection briefing={result.synthResult.briefing} />
              </div>
            </div>
          )}

          {runState === 'error' && (
            <div className="rounded-md border border-red-700 bg-red-950/40 p-3 text-sm text-red-200">
              <p className="mb-2">{error}</p>
              <button
                type="button"
                onClick={runPreview}
                className="bg-red-600 hover:bg-red-500 text-white px-3 py-1 rounded-md text-xs font-medium"
              >
                Retry
              </button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
