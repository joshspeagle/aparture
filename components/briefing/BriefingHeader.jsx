import TestModeBadge from '../ui/TestModeBadge.jsx';

// One-line claims-check status for the reading view, so an unaudited or
// flagged briefing is visible without opening "Generation details".
// Returns null for briefings saved before the check was recorded.
export function summarizeAudit(generationMetadata) {
  if (!generationMetadata || !('hallucinationCheck' in generationMetadata)) return null;
  const check = generationMetadata.hallucinationCheck;
  if (!check) {
    return { kind: 'not-run', text: 'claims check did not run' };
  }
  if (check.verdict === 'NO') return { kind: 'passed', text: 'claims checked' };
  const n = Array.isArray(check.flaggedClaims) ? check.flaggedClaims.length : 0;
  const what = n === 1 ? '1 claim' : `${n} claims`;
  return {
    kind: 'flagged',
    text: n > 0 ? `claims check flagged ${what}` : `claims check: ${check.verdict}`,
  };
}

export default function BriefingHeader({
  date,
  papersInFocus,
  papersScreened,
  readingTimeMinutes,
  testMode = false,
  audit = null,
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
        {audit && (
          <>
            {' · '}
            <span
              data-audit={audit.kind}
              // Warning text (CLAUDE.md semantic status colours): an
              // unaudited or flagged briefing should catch the eye.
              style={
                audit.kind === 'passed' ? undefined : { color: 'var(--aparture-warning-text)' }
              }
            >
              {audit.text}
            </span>
          </>
        )}
      </div>
    </header>
  );
}
