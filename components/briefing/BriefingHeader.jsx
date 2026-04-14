export default function BriefingHeader({
  date,
  papersInFocus,
  papersScreened,
  readingTimeMinutes,
}) {
  return (
    <header>
      <div className="meta-line">DAILY BRIEFING · {date} · Bringing the arXiv into focus</div>
      <hr className="hairline" />
      <div className="meta-line">
        {papersInFocus} papers in focus · {papersScreened} screened · ~{readingTimeMinutes} min
      </div>
    </header>
  );
}
