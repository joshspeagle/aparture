import TestModeBadge from '../ui/TestModeBadge.jsx';

export default function BriefingHeader({
  date,
  papersInFocus,
  papersScreened,
  readingTimeMinutes,
  testMode = false,
}) {
  return (
    <header>
      <div className="meta-line">
        DAILY BRIEFING · {date} · Bringing the arXiv into focus
        {/* Persisted trigger (generationMetadata.testMode), unlike the live
            dryRunInProgress trigger on the run surfaces. */}
        {testMode && <TestModeBadge label="TEST MODE · mock data" />}
      </div>
      <hr className="hairline" />
      <div className="meta-line">
        {/* papersScreened == null means the count wasn't recorded (archives
            predating generationMetadata.papersScreened) — omit the segment
            rather than showing a misleading "0 screened". */}
        {papersInFocus} papers in focus ·{' '}
        {papersScreened != null && <>{papersScreened} screened · </>}~{readingTimeMinutes} min
      </div>
    </header>
  );
}
