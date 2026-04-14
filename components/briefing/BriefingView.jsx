import { useState } from 'react';
import BriefingProse from './BriefingProse.jsx';
import BriefingHeader from './BriefingHeader.jsx';
import ExecutiveSummary from './ExecutiveSummary.jsx';
import ThemeSection from './ThemeSection.jsx';
import PaperCard from './PaperCard.jsx';
import DebateBlock from './DebateBlock.jsx';
import LongitudinalBlock from './LongitudinalBlock.jsx';
import ProactiveQuestionPanel from './ProactiveQuestionPanel.jsx';
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
  for (const debate of briefing.debates ?? []) {
    words += countWords(debate.summary ?? '');
  }
  return Math.max(1, Math.round(words / 250));
}

export default function BriefingView({
  briefing,
  date,
  papersScreened = 0,
  quickSummariesById = {},
  fullReportsById = {},
  onStar,
  onDismiss,
  onSkipQuestion,
  onPreviewProfileUpdate,
}) {
  const [openQuickId, setOpenQuickId] = useState(null);
  const [openFullId, setOpenFullId] = useState(null);

  const papersById = Object.fromEntries((briefing.papers ?? []).map((p) => [p.arxivId, p]));
  const readingTimeMinutes = estimateReadingTime(briefing);

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
                  onStar={onStar}
                  onDismiss={onDismiss}
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

      {(briefing.debates ?? []).map((debate, idx) => (
        <DebateBlock
          key={`debate-${idx}`}
          title={debate.title}
          summary={debate.summary}
          paperIds={debate.paperIds}
        />
      ))}

      {(briefing.longitudinal ?? []).map((conn, idx) => (
        <LongitudinalBlock
          key={`long-${idx}`}
          summary={conn.summary}
          todayPaperId={conn.todayPaperId}
          pastPaperId={conn.pastPaperId}
          pastDate={conn.pastDate}
        />
      ))}

      {(briefing.proactiveQuestions ?? []).map((q, idx) => (
        <ProactiveQuestionPanel
          key={`q-${idx}`}
          question={q.question}
          onSkip={onSkipQuestion}
          onPreview={onPreviewProfileUpdate}
        />
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
