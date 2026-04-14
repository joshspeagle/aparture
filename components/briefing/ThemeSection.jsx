export default function ThemeSection({ index, title, argument, children }) {
  return (
    <section className="theme-section">
      <div className="meta-line">── THEME {index} ──</div>
      <h2>{title}</h2>
      <p className="italic-pitch">{argument}</p>
      {children}
    </section>
  );
}
