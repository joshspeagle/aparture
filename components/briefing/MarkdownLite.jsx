// Minimal, dependency-free Markdown renderer for LLM-written report text (the
// full-report side panel, whose content composeFullReport builds as
// "## Summary\n\n…" sections). It builds React elements only — never an HTML
// string, never dangerouslySetInnerHTML — so model output cannot inject
// markup. Supported subset: ATX headings, paragraphs, bullet and numbered
// lists, **bold**, *italic*, `code`. Anything else renders as plain text.

// No lookbehind (older Safari can't parse it). Italic needs a non-space right
// after the opening `*`, so arithmetic like "a * b * c" stays plain text.
const INLINE = /(\*\*[^*\n]+\*\*|`[^`\n]+`|\*[^*\s][^*\n]*\*)/g;

export function renderInline(text, keyPrefix = 'i') {
  const out = [];
  let last = 0;
  let n = 0;
  for (const match of String(text).matchAll(INLINE)) {
    if (match.index > last) out.push(text.slice(last, match.index));
    const token = match[0];
    const key = `${keyPrefix}-${n++}`;
    if (token.startsWith('**')) out.push(<strong key={key}>{token.slice(2, -2)}</strong>);
    else if (token.startsWith('`')) out.push(<code key={key}>{token.slice(1, -1)}</code>);
    else out.push(<em key={key}>{token.slice(1, -1)}</em>);
    last = match.index + token.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function parseMarkdownBlocks(markdown) {
  const lines = String(markdown ?? '')
    .replace(/\r\n?/g, '\n')
    .split('\n');
  const blocks = [];
  let para = [];
  let list = null;
  const flushPara = () => {
    if (para.length > 0) blocks.push({ type: 'p', text: para.join(' ') });
    para = [];
  };
  const flushList = () => {
    if (list) blocks.push(list);
    list = null;
  };

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) {
      flushPara();
      flushList();
      continue;
    }
    const heading = /^(#{1,6})\s+(.*?)\s*#*$/.exec(line);
    if (heading) {
      flushPara();
      flushList();
      blocks.push({ type: 'h', level: heading[1].length, text: heading[2] });
      continue;
    }
    const bullet = /^[-*+]\s+(.*)$/.exec(line);
    const numbered = /^\d+[.)]\s+(.*)$/.exec(line);
    if (bullet || numbered) {
      flushPara();
      const ordered = Boolean(numbered);
      if (!list || list.ordered !== ordered) {
        flushList();
        list = { type: 'list', ordered, items: [] };
      }
      list.items.push((bullet ?? numbered)[1]);
      continue;
    }
    if (list && /^\s{2,}\S/.test(raw)) {
      // Indented continuation of the previous list item.
      list.items[list.items.length - 1] += ` ${line}`;
      continue;
    }
    flushList();
    para.push(line);
  }
  flushPara();
  flushList();
  return blocks;
}

export default function MarkdownLite({ text }) {
  return (
    <div className="report-markdown">
      {parseMarkdownBlocks(text).map((block, i) => {
        if (block.type === 'h') {
          // The panel title is the page-level heading, so report sections
          // ("## Summary") sit one level below it.
          const Heading = block.level <= 2 ? 'h3' : 'h4';
          return <Heading key={i}>{renderInline(block.text, `h${i}`)}</Heading>;
        }
        if (block.type === 'list') {
          const List = block.ordered ? 'ol' : 'ul';
          return (
            <List key={i}>
              {block.items.map((item, j) => (
                <li key={j}>{renderInline(item, `l${i}-${j}`)}</li>
              ))}
            </List>
          );
        }
        return <p key={i}>{renderInline(block.text, `p${i}`)}</p>;
      })}
    </div>
  );
}
