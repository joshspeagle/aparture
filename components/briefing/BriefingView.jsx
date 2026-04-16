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

function estimateReadingTime(briefing) {
  let words = countWords(briefing.executiveSummary ?? '');
  for (const theme of briefing.themes ?? []) {
    words += countWords(theme.argument ?? '') + countWords(theme.title ?? '');
  }
  for (const paper of briefing.papers ?? []) {
    words += countWords(paper.onelinePitch ?? '') + countWords(paper.whyMatters ?? '');
  }
  return Math.max(1, Math.round(words / 250));
}

export default function BriefingView({
  briefing,
  date,
  briefingDate,
  papersScreened = 0,
  quickSummariesById = {},
  fullReportsById = {},
  feedbackEvents,
  onStar,
  onDismiss,
  onAddComment,
}) {
  const [openQuickId, setOpenQuickId] = useState(null);
  const [openFullId, setOpenFullId] = useState(null);

  const papersById = Object.fromEntries((briefing.papers ?? []).map((p) => [p.arxivId, p]));
  const readingTimeMinutes = estimateReadingTime(briefing);

  const isStarred = (arxivId) =>
    feedbackEvents?.some((e) => e.type === 'star' && e.arxivId === arxivId) ?? false;
  const isDismissed = (arxivId) =>
    feedbackEvents?.some((e) => e.type === 'dismiss' && e.arxivId === arxivId) ?? false;

  return (
    <BriefingProse>
      <BriefingHeader
        date={date}
        papersInFocus={briefing.papers?.length ?? 0}
        papersScreened={papersScreened}
        readingTimeMinutes={readingTimeMinutes}
      />
      <ExecutiveSummary text={briefing.executiveSummary} />

      {(briefing.themes ?? []).map((theme, idx) => (
        <ThemeSection
          key={theme.title}
          index={idx + 1}
          title={theme.title}
          argument={theme.argument}
        >
          {(theme.paperIds ?? []).map((id) => {
            const paper = papersById[id];
            if (!paper) return null;
            return (
              <div key={id}>
                <PaperCard
                  paper={paper}
                  starred={isStarred(paper.arxivId)}
                  dismissed={isDismissed(paper.arxivId)}
                  briefingDate={briefingDate}
                  feedbackEvents={feedbackEvents}
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
          })}
        </ThemeSection>
      ))}

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
