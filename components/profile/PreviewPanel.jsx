import { useMemo, useState } from 'react';
import { MODEL_REGISTRY } from '../../utils/models.js';
import BriefingView from '../briefing/BriefingView.jsx';
import Button from '../ui/Button.jsx';

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
    <div
      style={{
        borderRadius: '4px',
        border: '1px solid var(--aparture-hairline)',
        background: 'var(--aparture-bg)',
        padding: 'var(--aparture-space-3)',
      }}
    >
      <h4
        style={{
          fontFamily: 'var(--aparture-font-sans)',
          fontSize: 'var(--aparture-text-sm)',
          fontWeight: 600,
          color: 'var(--aparture-ink)',
          marginBottom: '8px',
        }}
      >
        {dropped.length} {dropped.length === 1 ? 'paper' : 'papers'} would be filtered out
      </h4>
      {dropped.length === 0 ? (
        <p
          style={{
            fontFamily: 'var(--aparture-font-sans)',
            fontSize: 'var(--aparture-text-xs)',
            color: 'var(--aparture-mute)',
            fontStyle: 'italic',
          }}
        >
          No papers dropped by filter
        </p>
      ) : (
        <ul
          style={{
            fontFamily: 'var(--aparture-font-sans)',
            fontSize: 'var(--aparture-text-xs)',
            color: 'var(--aparture-ink)',
            listStyle: 'disc',
            listStylePosition: 'inside',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
          }}
        >
          {dropped.map((p) => (
            <li key={p.arxivId}>{p.title}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ScoringShiftsSection({ shifts }) {
  const cellStyle = {
    padding: '4px 8px',
    fontFamily: 'var(--aparture-font-sans)',
    fontSize: 'var(--aparture-text-xs)',
  };

  if (!shifts || shifts.length === 0) {
    return (
      <div
        style={{
          borderRadius: '4px',
          border: '1px solid var(--aparture-hairline)',
          background: 'var(--aparture-bg)',
          padding: 'var(--aparture-space-3)',
        }}
      >
        <h4
          style={{
            fontFamily: 'var(--aparture-font-sans)',
            fontSize: 'var(--aparture-text-sm)',
            fontWeight: 600,
            color: 'var(--aparture-ink)',
            marginBottom: '8px',
          }}
        >
          Scoring shifts
        </h4>
        <p
          style={{
            fontFamily: 'var(--aparture-font-sans)',
            fontSize: 'var(--aparture-text-xs)',
            color: 'var(--aparture-mute)',
            fontStyle: 'italic',
          }}
        >
          No papers scored — all were filtered out.
        </p>
      </div>
    );
  }

  return (
    <div
      style={{
        borderRadius: '4px',
        border: '1px solid var(--aparture-hairline)',
        background: 'var(--aparture-bg)',
        padding: 'var(--aparture-space-3)',
      }}
    >
      <h4
        style={{
          fontFamily: 'var(--aparture-font-sans)',
          fontSize: 'var(--aparture-text-sm)',
          fontWeight: 600,
          color: 'var(--aparture-ink)',
          marginBottom: '8px',
        }}
      >
        Scoring shifts
      </h4>
      <div style={{ overflowX: 'auto' }}>
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            fontFamily: 'var(--aparture-font-sans)',
            fontSize: 'var(--aparture-text-xs)',
            color: 'var(--aparture-ink)',
          }}
        >
          <thead>
            <tr
              style={{
                textAlign: 'left',
                color: 'var(--aparture-mute)',
                borderBottom: '1px solid var(--aparture-hairline)',
              }}
            >
              <th style={cellStyle}>Rank before</th>
              <th style={cellStyle}>Title</th>
              <th style={cellStyle}>Old score</th>
              <th style={cellStyle}>New score</th>
              <th style={cellStyle}>Rank after</th>
              <th style={cellStyle}>{'\u0394'}</th>
            </tr>
          </thead>
          <tbody>
            {shifts.map((s) => {
              const rowBg =
                s.delta > 0
                  ? 'rgba(34,197,94,0.08)'
                  : s.delta < 0
                    ? 'rgba(239,68,68,0.08)'
                    : 'transparent';
              const deltaStr = s.delta > 0 ? `+${s.delta}` : `${s.delta}`;
              return (
                <tr
                  key={s.arxivId}
                  style={{
                    borderBottom: '1px solid var(--aparture-hairline)',
                    background: rowBg,
                  }}
                >
                  <td style={cellStyle}>{s.rankBefore ?? '\u2014'}</td>
                  <td style={cellStyle}>{s.title}</td>
                  <td style={cellStyle}>
                    {typeof s.oldScore === 'number' ? s.oldScore.toFixed(1) : '\u2014'}
                  </td>
                  <td style={cellStyle}>
                    {typeof s.newScore === 'number' ? s.newScore.toFixed(1) : '\u2014'}
                  </td>
                  <td style={cellStyle}>{s.rankAfter}</td>
                  <td style={cellStyle}>{deltaStr}</td>
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
    <div
      style={{
        borderRadius: '4px',
        border: '1px dashed var(--aparture-accent)',
        background: 'rgba(179,27,27,0.04)',
        padding: 'var(--aparture-space-3)',
      }}
    >
      <div
        style={{
          fontFamily: 'var(--aparture-font-sans)',
          fontSize: 'var(--aparture-text-xs)',
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          color: 'var(--aparture-accent)',
          marginBottom: '8px',
        }}
      >
        Preview — not saved
      </div>
      <div
        style={{
          background: 'var(--aparture-bg)',
          borderRadius: '4px',
          padding: 'var(--aparture-space-3)',
        }}
      >
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
    'running-filter': 'Running filter\u2026',
    'running-score': 'Running scoring\u2026',
    'running-synth': 'Running synthesis\u2026',
  };

  const isRunning =
    runState === 'running-filter' || runState === 'running-score' || runState === 'running-synth';

  return (
    <section
      style={{
        borderRadius: '4px',
        border: '1px solid var(--aparture-hairline)',
        background: 'var(--aparture-surface)',
        padding: 'var(--aparture-space-4)',
        marginTop: 'var(--aparture-space-3)',
      }}
    >
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 'var(--aparture-space-3)',
        }}
      >
        <h3
          style={{
            fontFamily: 'var(--aparture-font-sans)',
            fontSize: 'var(--aparture-text-sm)',
            fontWeight: 600,
            color: 'var(--aparture-ink)',
          }}
        >
          Preview — profile changes
        </h3>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close preview"
          style={{
            fontFamily: 'var(--aparture-font-sans)',
            fontSize: 'var(--aparture-text-lg)',
            lineHeight: 1,
            color: 'var(--aparture-mute)',
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          {'\u00d7'}
        </button>
      </header>

      {!lastRun ? (
        <p
          style={{
            fontFamily: 'var(--aparture-font-sans)',
            fontSize: 'var(--aparture-text-xs)',
            color: 'var(--aparture-mute)',
          }}
        >
          No recent analysis to preview against. Run a full analysis first.
        </p>
      ) : (
        <div>
          {runState === 'idle' && (
            <>
              <p
                style={{
                  fontFamily: 'var(--aparture-font-sans)',
                  fontSize: 'var(--aparture-text-xs)',
                  color: 'var(--aparture-mute)',
                  marginBottom: 'var(--aparture-space-3)',
                }}
              >
                Will run filter + scoring + synthesis on {sample.length} cached papers (top 10 + up
                to 5 borderline).
              </p>
              <Button variant="primary" onClick={runPreview} title="~$0.15–0.30 per run · ~45–90s">
                Run preview
              </Button>
            </>
          )}

          {isRunning && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontFamily: 'var(--aparture-font-sans)',
                fontSize: 'var(--aparture-text-sm)',
                color: 'var(--aparture-ink)',
              }}
            >
              <span
                aria-hidden="true"
                className="animate-spin"
                style={{
                  display: 'inline-block',
                  height: '12px',
                  width: '12px',
                  borderRadius: '50%',
                  border: '2px solid var(--aparture-hairline)',
                  borderTopColor: 'var(--aparture-ink)',
                }}
              />
              <span>{stageLabel[runState]}</span>
            </div>
          )}

          {runState === 'done' && result && (
            <div
              style={{
                fontFamily: 'var(--aparture-font-sans)',
                fontSize: 'var(--aparture-text-sm)',
                color: 'var(--aparture-ink)',
              }}
            >
              <p style={{ marginBottom: 'var(--aparture-space-3)' }}>
                Preview complete. {result.reScored.length} papers kept by filter
                {result.reScored.length > 0 && (
                  <>
                    {', top paper now scoring '}
                    {result.reScored[0].newScore.toFixed(1)}
                  </>
                )}
                .
              </p>
              <div
                style={{
                  marginTop: 'var(--aparture-space-4)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 'var(--aparture-space-6)',
                }}
              >
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
            <div
              style={{
                borderRadius: '4px',
                border: '1px solid rgba(239,68,68,0.3)',
                background: 'rgba(239,68,68,0.08)',
                padding: 'var(--aparture-space-3)',
                fontFamily: 'var(--aparture-font-sans)',
                fontSize: 'var(--aparture-text-sm)',
                color: '#ef4444',
              }}
            >
              <p style={{ marginBottom: '8px' }}>{error}</p>
              <Button variant="primary" onClick={runPreview}>
                Retry
              </Button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
