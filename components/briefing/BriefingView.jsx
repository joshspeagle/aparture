import { useState } from 'react';
import BriefingProse from './BriefingProse.jsx';
import BriefingHeader from './BriefingHeader.jsx';
import ExecutiveSummary from './ExecutiveSummary.jsx';
import ThemeSection from './ThemeSection.jsx';
import PaperCard from './PaperCard.jsx';
import QuickSummaryInline from './QuickSummaryInline.jsx';
import FullReportSidePanel from './FullReportSidePanel.jsx';

function countWords(text) {
  return text.split(/\s+/).filter(Boolean).length;
}

function estimateReadingTime(briefing, papers) {
  let words = countWords(briefing.executiveSummary ?? '');
  for (const theme of briefing.themes ?? []) {
    words += countWords(theme.argument ?? '') + countWords(theme.title ?? '');
  }
  for (const paper of papers) {
    words += countWords(paper.onelinePitch ?? '') + countWords(paper.whyMatters ?? '');
  }
  return Math.max(1, Math.round(words / 250));
}

// Decide where each card renders. Every paper renders exactly once: in the
// first theme that lists it (a paper the model put in two themes used to
// render twice), and a card the model put in NO theme lands in a final
// "Other papers" group (it used to silently vanish, while still being
// counted in "N papers in focus"). Theme ids without a card render nothing.
export function layoutBriefing(briefing) {
  const papers = [];
  const papersById = {};
  for (const paper of briefing?.papers ?? []) {
    if (!paper?.arxivId || papersById[paper.arxivId]) continue; // first card wins
    papersById[paper.arxivId] = paper;
    papers.push(paper);
  }
  const placed = new Set();
  const themes = (briefing?.themes ?? []).map((theme) => {
    const ids = [];
    const alsoAbove = [];
    for (const id of theme?.paperIds ?? []) {
      if (!papersById[id]) continue;
      if (placed.has(id)) {
        if (!alsoAbove.includes(id)) alsoAbove.push(id);
        continue;
      }
      placed.add(id);
      ids.push(id);
    }
    return { theme, ids, alsoAbove };
  });
  const orphanIds = papers.map((p) => p.arxivId).filter((id) => !placed.has(id));
  return { papers, papersById, themes, orphanIds };
}

export default function BriefingView({
  briefing,
  date,
  briefingDate,
  // null (the default) means "not recorded" — BriefingHeader omits the
  // "· N screened" segment rather than rendering a misleading 0.
  papersScreened = null,
  testMode = false,
  quickSummariesById = {},
  fullReportsById = {},
  feedbackEvents,
  onStar,
  onDismiss,
  onAddComment,
}) {
  const [openQuickId, setOpenQuickId] = useState(null);
  const [openFullId, setOpenFullId] = useState(null);

  const { papers, papersById, themes, orphanIds } = layoutBriefing(briefing);
  const readingTimeMinutes = estimateReadingTime(briefing, papers);

  const isStarred = (arxivId) =>
    feedbackEvents?.some((e) => e.type === 'star' && e.arxivId === arxivId) ?? false;
  const isDismissed = (arxivId) =>
    feedbackEvents?.some((e) => e.type === 'dismiss' && e.arxivId === arxivId) ?? false;

  const renderCard = (id) => {
    const paper = papersById[id];
    return (
      <div key={id}>
        <PaperCard
          paper={paper}
          starred={isStarred(paper.arxivId)}
          dismissed={isDismissed(paper.arxivId)}
          briefingDate={briefingDate}
          feedbackEvents={feedbackEvents}
          testMode={testMode}
          onStar={onStar}
          onDismiss={onDismiss}
          onAddComment={onAddComment}
          onOpenQuickSummary={(pid) => setOpenQuickId(pid === openQuickId ? null : pid)}
          onOpenFullReport={(pid) => setOpenFullId(pid)}
        />
        <QuickSummaryInline
          open={openQuickId === id}
          text={quickSummariesById[id] ?? 'Quick summary not yet generated.'}
        />
      </div>
    );
  };

  return (
    <BriefingProse>
      <BriefingHeader
        date={date}
        papersInFocus={papers.length}
        papersScreened={papersScreened}
        readingTimeMinutes={readingTimeMinutes}
        testMode={testMode}
      />
      <ExecutiveSummary text={briefing.executiveSummary} />

      {themes.map(({ theme, ids, alsoAbove }, idx) => (
        <ThemeSection
          // Index-keyed: theme titles are LLM output with no uniqueness
          // guarantee, and the list is static per briefing (never reordered).
          key={idx}
          index={idx + 1}
          title={theme.title}
          argument={theme.argument}
        >
          {alsoAbove.length > 0 && (
            <p className="meta-line">
              Also in this theme (shown above):{' '}
              {alsoAbove.map((id) => papersById[id].title).join('; ')}
            </p>
          )}
          {ids.map(renderCard)}
        </ThemeSection>
      ))}

      {orphanIds.length > 0 && (
        <ThemeSection
          label="OTHER PAPERS"
          title="Other papers"
          argument="The briefing did not place these papers in a theme."
        >
          {orphanIds.map(renderCard)}
        </ThemeSection>
      )}

      <FullReportSidePanel
        open={openFullId !== null}
        onOpenChange={(open) => setOpenFullId(open ? openFullId : null)}
        title={openFullId ? (papersById[openFullId]?.title ?? '') : ''}
        content={
          openFullId ? (fullReportsById[openFullId] ?? 'Full report not yet available.') : ''
        }
      />
    </BriefingProse>
  );
}
