// components/briefing/GenerationDetails.jsx
// Collapsible disclosure panel showing per-briefing provenance:
// profile snapshot, model IDs, categories, filter verdict counts,
// retry settings, and generation timestamp.

import { useState } from 'react';
import * as Collapsible from '@radix-ui/react-collapsible';
import Card from '../ui/Card.jsx';

export default function GenerationDetails({ generationMetadata }) {
  const [open, setOpen] = useState(false);
  const [showFullProfile, setShowFullProfile] = useState(false);

  if (!generationMetadata) {
    return (
      <p
        style={{
          fontFamily: 'var(--aparture-font-sans)',
          fontSize: 'var(--aparture-text-sm)',
          color: 'var(--aparture-mute)',
          marginTop: 'var(--aparture-space-6)',
        }}
      >
        Generation details not captured for this briefing.
      </p>
    );
  }

  const {
    profileSnapshot,
    filterModel,
    scoringModel,
    pdfModel,
    briefingModel,
    categories,
    filterVerdictCounts,
    briefingRetryOnYes,
    briefingRetryOnMaybe,
    pauseAfterFilter,
    timestamp,
  } = generationMetadata;

  const profilePreview =
    profileSnapshot && profileSnapshot.length > 200
      ? profileSnapshot.slice(0, 200) + '...'
      : profileSnapshot;

  const formattedTimestamp = timestamp ? new Date(timestamp).toLocaleString() : 'Unknown';

  const labelStyle = {
    fontFamily: 'var(--aparture-font-sans)',
    fontSize: 'var(--aparture-text-xs)',
    color: 'var(--aparture-mute)',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    marginBottom: '4px',
  };

  const valueStyle = {
    fontFamily: 'var(--aparture-font-sans)',
    fontSize: 'var(--aparture-text-sm)',
    color: 'var(--aparture-ink)',
  };

  const monoValueStyle = {
    fontFamily: 'var(--aparture-font-mono)',
    fontSize: 'var(--aparture-text-xs)',
    color: 'var(--aparture-ink)',
  };

  const sectionStyle = {
    marginBottom: 'var(--aparture-space-4)',
  };

  const pillStyle = {
    display: 'inline-block',
    fontFamily: 'var(--aparture-font-mono)',
    fontSize: 'var(--aparture-text-xs)',
    color: 'var(--aparture-ink)',
    background: 'var(--aparture-bg)',
    border: '1px solid var(--aparture-hairline)',
    borderRadius: '12px',
    padding: '2px 10px',
    marginRight: '6px',
    marginBottom: '4px',
  };

  const flagStyle = (isOn) => ({
    fontFamily: 'var(--aparture-font-sans)',
    fontSize: 'var(--aparture-text-xs)',
    color: isOn ? 'var(--aparture-ink)' : 'var(--aparture-mute)',
    marginRight: 'var(--aparture-space-4)',
  });

  return (
    <Collapsible.Root
      open={open}
      onOpenChange={setOpen}
      style={{ marginTop: 'var(--aparture-space-6)' }}
    >
      <Collapsible.Trigger asChild>
        <button
          type="button"
          style={{
            fontFamily: 'var(--aparture-font-sans)',
            fontSize: 'var(--aparture-text-sm)',
            color: 'var(--aparture-mute)',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: 0,
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
          }}
        >
          Generation details {open ? '\u25be' : '\u25b8'}
        </button>
      </Collapsible.Trigger>

      <Collapsible.Content>
        <Card style={{ marginTop: 'var(--aparture-space-3)' }}>
          {/* Profile snapshot */}
          {profileSnapshot && (
            <div style={sectionStyle}>
              <div style={labelStyle}>Profile snapshot</div>
              <div style={valueStyle}>
                {showFullProfile || profileSnapshot.length <= 200
                  ? profileSnapshot
                  : profilePreview}
              </div>
              {profileSnapshot.length > 200 && (
                <button
                  type="button"
                  onClick={() => setShowFullProfile((v) => !v)}
                  style={{
                    fontFamily: 'var(--aparture-font-sans)',
                    fontSize: 'var(--aparture-text-xs)',
                    color: 'var(--aparture-accent)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: 0,
                    marginTop: '4px',
                  }}
                >
                  {showFullProfile ? 'show less' : 'show full'}
                </button>
              )}
            </div>
          )}

          {/* Models */}
          <div style={sectionStyle}>
            <div style={labelStyle}>Models</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--aparture-space-4)' }}>
              {filterModel && <span style={monoValueStyle}>filter: {filterModel}</span>}
              {scoringModel && <span style={monoValueStyle}>scoring: {scoringModel}</span>}
              {pdfModel && <span style={monoValueStyle}>PDF: {pdfModel}</span>}
              {briefingModel && <span style={monoValueStyle}>briefing: {briefingModel}</span>}
            </div>
          </div>

          {/* Categories */}
          {categories?.length > 0 && (
            <div style={sectionStyle}>
              <div style={labelStyle}>Categories</div>
              <div style={{ display: 'flex', flexWrap: 'wrap' }}>
                {categories.map((cat) => (
                  <span key={cat} style={pillStyle}>
                    {cat}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Filter verdicts */}
          {filterVerdictCounts && (
            <div style={sectionStyle}>
              <div style={labelStyle}>Filter verdicts</div>
              <div style={monoValueStyle}>
                {filterVerdictCounts.yes ?? 0} YES / {filterVerdictCounts.maybe ?? 0} MAYBE /{' '}
                {filterVerdictCounts.no ?? 0} NO
              </div>
            </div>
          )}

          {/* Settings */}
          <div style={sectionStyle}>
            <div style={labelStyle}>Settings</div>
            <div>
              <span style={flagStyle(pauseAfterFilter)}>
                pauseAfterFilter: {pauseAfterFilter ? 'on' : 'off'}
              </span>
              <span style={flagStyle(briefingRetryOnYes)}>
                briefingRetryOnYes: {briefingRetryOnYes ? 'on' : 'off'}
              </span>
              <span style={flagStyle(briefingRetryOnMaybe)}>
                briefingRetryOnMaybe: {briefingRetryOnMaybe ? 'on' : 'off'}
              </span>
            </div>
          </div>

          {/* Generated at */}
          <div>
            <div style={labelStyle}>Generated at</div>
            <div style={monoValueStyle}>{formattedTimestamp}</div>
          </div>
        </Card>
      </Collapsible.Content>
    </Collapsible.Root>
  );
}
