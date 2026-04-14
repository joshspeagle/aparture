export default function DebateBlock({ title, summary, paperIds }) {
  return (
    <section className="paper-card block-debate">
      <div className="meta-line">⚡ ── DEBATE ──</div>
      <h3 className="paper-title">{title}</h3>
      <p>{summary}</p>
      {paperIds?.length ? (
        <div className="paper-meta">References: {paperIds.join(', ')}</div>
      ) : null}
    </section>
  );
}
