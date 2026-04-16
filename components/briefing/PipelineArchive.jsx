// components/briefing/PipelineArchive.jsx
// Body content for the pipeline details view: filter verdicts (per-paper),
// abstract scores, and deep-analysis score adjustments. Rendered inside
// PipelineArchiveView as a dedicated page.

import { useState } from 'react';
import Card from '../ui/Card.jsx';

const labelStyle = {
  fontFamily: 'var(--aparture-font-sans)',
  fontSize: 'var(--aparture-text-xs)',
  color: 'var(--aparture-mute)',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  marginBottom: 'var(--aparture-space-2)',
};

const sectionStyle = { marginBottom: 'var(--aparture-space-6)' };

const monoValueStyle = {
  fontFamily: 'var(--aparture-font-mono)',
  fontSize: 'var(--aparture-text-xs)',
  color: 'var(--aparture-ink)',
};

const paperRowStyle = {
  padding: 'var(--aparture-space-2) 0',
  borderBottom: '1px solid var(--aparture-hairline)',
};

function PaperEntry({ arxivId, title, score, justification, summary, adjustment }) {
  return (
    <div style={paperRowStyle}>
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          gap: 'var(--aparture-space-2)',
          marginBottom: '4px',
        }}
      >
        {typeof score === 'number' && (
          <span style={{ ...monoValueStyle, fontWeight: 600 }}>{score.toFixed(1)}</span>
        )}
        <span
          style={{
            fontFamily: 'var(--aparture-font-sans)',
            fontSize: 'var(--aparture-text-sm)',
            color: 'var(--aparture-ink)',
            flex: 1,
          }}
        >
          {title}
        </span>
        <a
          href={`https://arxiv.org/abs/${arxivId}`}
          target="_blank"
          rel="noreferrer"
          style={{ ...monoValueStyle, color: 'var(--aparture-mute)', textDecoration: 'none' }}
        >
          {arxivId}
        </a>
      </div>
      {summary && (
        <div
          style={{
            fontFamily: 'var(--aparture-font-sans)',
            fontSize: 'var(--aparture-text-xs)',
            color: 'var(--aparture-mute)',
            marginBottom: '2px',
          }}
        >
          {summary}
        </div>
      )}
      {justification && (
        <div
          style={{
            fontFamily: 'var(--aparture-font-sans)',
            fontSize: 'var(--aparture-text-xs)',
            color: 'var(--aparture-ink)',
            fontStyle: 'italic',
          }}
        >
          {justification}
        </div>
      )}
      {adjustment && (
        <div
          style={{
            fontFamily: 'var(--aparture-font-sans)',
            fontSize: 'var(--aparture-text-xs)',
            color: 'var(--aparture-accent)',
            marginTop: '2px',
          }}
        >
          {adjustment}
        </div>
      )}
    </div>
  );
}

function FilterBucket({ label, papers, color }) {
  const [open, setOpen] = useState(false);
  if (!papers || papers.length === 0) {
    return (
      <div style={{ marginBottom: 'var(--aparture-space-2)' }}>
        <span style={{ ...monoValueStyle, color: 'var(--aparture-mute)' }}>{label}: 0 papers</span>
      </div>
    );
  }
  return (
    <div style={{ marginBottom: 'var(--aparture-space-3)' }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          fontFamily: 'var(--aparture-font-mono)',
          fontSize: 'var(--aparture-text-sm)',
          color,
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: 0,
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px',
          fontWeight: 600,
        }}
      >
        {label}: {papers.length} papers {open ? '\u25be' : '\u25b8'}
      </button>
      {open && (
        <div style={{ marginTop: 'var(--aparture-space-2)' }}>
          {papers.map((p) => (
            <PaperEntry
              key={p.arxivId ?? p.id}
              arxivId={p.arxivId ?? p.id}
              title={p.title}
              summary={p.filterSummary}
              justification={p.filterJustification}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function PipelineArchive({ pipelineArchive }) {
  if (!pipelineArchive) {
    return (
      <Card>
        <p
          style={{
            fontFamily: 'var(--aparture-font-sans)',
            fontSize: 'var(--aparture-text-sm)',
            color: 'var(--aparture-mute)',
            margin: 0,
          }}
        >
          No pipeline archive captured for this briefing.
        </p>
      </Card>
    );
  }

  const { filterResults, scoredPapers = [], finalRanking = [] } = pipelineArchive;

  const sortedScored = [...scoredPapers].sort((a, b) => {
    const aScore = a.relevanceScore ?? a.score ?? 0;
    const bScore = b.relevanceScore ?? b.score ?? 0;
    return bScore - aScore;
  });

  return (
    <Card>
      {/* Filter stage */}
      {filterResults && (
        <div style={sectionStyle}>
          <div style={labelStyle}>Filter stage</div>
          <FilterBucket label="YES" papers={filterResults.yes} color="#15803d" />
          <FilterBucket label="MAYBE" papers={filterResults.maybe} color="#b45309" />
          <FilterBucket label="NO" papers={filterResults.no} color="var(--aparture-mute)" />
        </div>
      )}

      {/* Scoring stage */}
      {sortedScored.length > 0 && (
        <div style={sectionStyle}>
          <div style={labelStyle}>Abstract scoring ({sortedScored.length} papers)</div>
          <div>
            {sortedScored.map((p) => (
              <PaperEntry
                key={p.arxivId ?? p.id}
                arxivId={p.arxivId ?? p.id}
                title={p.title}
                score={p.relevanceScore ?? p.score}
                justification={p.justification ?? p.scoreJustification}
                adjustment={
                  p.adjustmentReason
                    ? `Post-processing → ${(p.adjustedScore ?? p.relevanceScore).toFixed(1)}: ${p.adjustmentReason}`
                    : null
                }
              />
            ))}
          </div>
        </div>
      )}

      {/* Deep analysis */}
      {finalRanking.length > 0 && (
        <div style={sectionStyle}>
          <div style={labelStyle}>Deep PDF analysis ({finalRanking.length} papers)</div>
          <div>
            {finalRanking.map((p) => {
              const pre = p.preAnalysisScore ?? p.relevanceScore ?? 0;
              const delta = p.pdfScoreAdjustment ?? 0;
              const final = p.score ?? p.finalScore ?? 0;
              const deltaStr = delta === 0 ? '' : ` (${delta > 0 ? '+' : ''}${delta.toFixed(1)})`;
              return (
                <PaperEntry
                  key={p.arxivId ?? p.id}
                  arxivId={p.arxivId ?? p.id}
                  title={p.title}
                  score={final}
                  adjustment={
                    delta !== 0
                      ? `PDF analysis: ${pre.toFixed(1)}${deltaStr} → ${final.toFixed(1)}`
                      : null
                  }
                />
              );
            })}
          </div>
        </div>
      )}
    </Card>
  );
}
