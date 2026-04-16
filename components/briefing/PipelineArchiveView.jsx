// components/briefing/PipelineArchiveView.jsx
// Dedicated page view for inspecting a briefing's pipeline trail. Paired
// with BriefingView: each briefing has a "View pipeline details →" button
// on its reading view that navigates here, and this view has a "Back to
// briefing" button to return.

import { ArrowLeft } from 'lucide-react';
import Button from '../ui/Button.jsx';
import PipelineArchive from './PipelineArchive.jsx';

export default function PipelineArchiveView({ entry, onBack }) {
  if (!entry) {
    return (
      <div className="briefing-surface">
        <p style={{ color: 'var(--aparture-mute)', fontFamily: 'var(--aparture-font-sans)' }}>
          Briefing not found.
        </p>
      </div>
    );
  }

  const formattedDate = entry.date
    ? new Date(entry.date).toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      })
    : '';

  return (
    <div className="briefing-surface">
      <div style={{ marginBottom: 'var(--aparture-space-4)' }}>
        <Button variant="ghost" onClick={onBack}>
          <ArrowLeft className="w-4 h-4" />
          Back to briefing
        </Button>
      </div>

      <header style={{ marginBottom: 'var(--aparture-space-6)' }}>
        <div
          style={{
            fontFamily: 'var(--aparture-font-sans)',
            fontSize: 'var(--aparture-text-xs)',
            color: 'var(--aparture-mute)',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            marginBottom: '4px',
          }}
        >
          Pipeline details
        </div>
        <h1
          style={{
            fontFamily: 'var(--aparture-font-serif)',
            fontSize: 'var(--aparture-text-3xl)',
            fontWeight: 600,
            color: 'var(--aparture-ink)',
            margin: 0,
          }}
        >
          {formattedDate}
        </h1>
        <p
          style={{
            fontFamily: 'var(--aparture-font-sans)',
            fontSize: 'var(--aparture-text-sm)',
            color: 'var(--aparture-mute)',
            marginTop: 'var(--aparture-space-2)',
            marginBottom: 0,
          }}
        >
          The full pipeline trail for this briefing: which papers were fetched, how they were
          filtered and scored, and how the final ranking was produced.
        </p>
      </header>

      <PipelineArchive pipelineArchive={entry.pipelineArchive} />
    </div>
  );
}
