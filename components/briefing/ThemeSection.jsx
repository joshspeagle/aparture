// `label` overrides the "THEME N" meta-line (used for the view's own
// "Other papers" group, which is not one of the model's themes).
export default function ThemeSection({ index, label, title, argument, children }) {
  return (
    <section className="theme-section">
      <div className="meta-line">── {label ?? `THEME ${index}`} ──</div>
      <h2>{title}</h2>
      {argument ? <p className="italic-pitch">{argument}</p> : null}
      {children}
    </section>
  );
}
