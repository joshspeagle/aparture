// The synthesis prompt asks for a 2–4 paragraph lede. Rendering it as one
// <p> merged the paragraphs into a single block (HTML collapses the newlines),
// so split on blank lines — or, when the model separated paragraphs with
// single newlines only, on those.
export function splitParagraphs(text) {
  const source = String(text ?? '').trim();
  if (!source) return [];
  const byBlankLine = source.split(/\n\s*\n/);
  const blocks = byBlankLine.length > 1 ? byBlankLine : source.split(/\n/);
  return blocks.map((b) => b.replace(/\s*\n\s*/g, ' ').trim()).filter(Boolean);
}

export default function ExecutiveSummary({ text }) {
  return (
    <div className="executive-summary">
      {splitParagraphs(text).map((para, i) => (
        <p key={i}>{para}</p>
      ))}
    </div>
  );
}
