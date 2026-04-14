export default function LongitudinalBlock({ summary, todayPaperId, pastPaperId, pastDate }) {
  return (
    <section className="paper-card block-longitudinal">
      <div className="meta-line">── LONGITUDINAL ──</div>
      <p>{summary}</p>
      <div className="paper-meta">
        Today: {todayPaperId} · Past ({pastDate}): {pastPaperId}
      </div>
    </section>
  );
}
