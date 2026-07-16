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
        {testMode && (
          <span
            style={{
              marginLeft: '10px',
              padding: '1px 8px',
              background: 'rgba(245,158,11,0.12)',
              color: '#f59e0b',
              borderRadius: '10px',
              fontSize: '0.85em',
              whiteSpace: 'nowrap',
            }}
          >
            TEST MODE · mock data
          </span>
        )}
      </div>
      <hr className="hairline" />
      <div className="meta-line">
        {papersInFocus} papers in focus · {papersScreened} screened · ~{readingTimeMinutes} min
      </div>
    </header>
  );
}
