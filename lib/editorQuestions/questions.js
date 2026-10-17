// Editor's questions: up to two tap-to-answer questions asked at the end of a
// briefing when the day's papers exposed an ambiguity in the reader's
// profile. The answers become `answer` feedback events, which reach
// suggest-profile as evidence. Rendering and validation live here; the route
// is pages/api/editor-questions.js and the prompt prompts/editor-questions.md.

export const MAX_QUESTIONS = 2;
export const MIN_OPTIONS = 2;
export const MAX_OPTIONS = 4;
const MAX_OPTION_CHARS = 80;
const MAX_TEXT_CHARS = 400;
const MAX_NEAR_MISSES = 15;

// Portable structured-output subset (CLAUDE.md "Structured-output
// portability rules"): every object closed, every property required, no
// count or length keywords. Counts and lengths are enforced below.
export function editorQuestionsJsonSchema() {
  return {
    type: 'object',
    additionalProperties: false,
    required: ['questions'],
    properties: {
      questions: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['id', 'text', 'options', 'evidence'],
          properties: {
            id: { type: 'string' },
            text: { type: 'string' },
            options: { type: 'array', items: { type: 'string' } },
            evidence: { type: 'array', items: { type: 'string' } },
          },
        },
      },
    },
  };
}

const oneLine = (s) =>
  String(s ?? '')
    .replace(/\s+/g, ' ')
    .trim();

export function renderPaperLines(papers = []) {
  if (!Array.isArray(papers) || papers.length === 0) return '(none)';
  return papers
    .map((p) => {
      const score = typeof p.score === 'number' ? ` (${p.score.toFixed(1)})` : '';
      const pitch = p.pitch ? `: ${oneLine(p.pitch)}` : '';
      return `- ${p.arxivId} "${oneLine(p.title)}"${score}${pitch}`;
    })
    .join('\n');
}

// Recent feedback as one line per event: what the reader starred, dismissed
// or said, and the questions they already answered (so they aren't asked
// again).
export function renderFeedbackLines(events = []) {
  const lines = [];
  for (const e of events) {
    if (e.type === 'star') lines.push(`- starred ${e.arxivId} "${oneLine(e.paperTitle)}"`);
    else if (e.type === 'dismiss')
      lines.push(`- dismissed ${e.arxivId} "${oneLine(e.paperTitle)}"`);
    else if (e.type === 'paper-comment' && e.text)
      lines.push(`- commented on ${e.arxivId}: "${oneLine(e.text)}"`);
    else if (e.type === 'general-comment' && e.text) lines.push(`- noted: "${oneLine(e.text)}"`);
    else if (e.type === 'answer')
      lines.push(`- answered "${oneLine(e.question)}" with "${oneLine(e.answer)}"`);
  }
  return lines.length > 0 ? lines.join('\n') : '(none yet)';
}

export function renderEditorQuestionsPrompt(
  template,
  { profile, papers, nearMisses, feedbackEvents }
) {
  return template
    .replaceAll('{{profile}}', () => profile ?? '')
    .replaceAll('{{feedback}}', () => renderFeedbackLines(feedbackEvents))
    .replaceAll('{{papers}}', () => renderPaperLines(papers))
    .replaceAll('{{nearMisses}}', () =>
      renderPaperLines((nearMisses ?? []).slice(0, MAX_NEAR_MISSES))
    );
}

/**
 * Keep only questions that are well formed and grounded in today's papers.
 * Rejected questions are reported, never repaired by guesswork.
 *
 * @param {unknown} raw            the model's structured output
 * @param {Iterable<string>} allowedIds  arXiv IDs the model was shown
 * @returns {{questions: Array<{id, text, options, evidence}>, dropped: string[]}}
 */
export function validateEditorQuestions(raw, allowedIds) {
  const allowed = new Set(allowedIds);
  const dropped = [];
  const questions = [];
  const list = Array.isArray(raw?.questions) ? raw.questions : [];
  for (const q of list) {
    if (questions.length === MAX_QUESTIONS) {
      dropped.push('more than two questions');
      break;
    }
    const text = oneLine(q?.text);
    const options = (Array.isArray(q?.options) ? q.options : [])
      .map(oneLine)
      .filter(Boolean)
      .filter((o, i, all) => all.indexOf(o) === i);
    const evidence = (Array.isArray(q?.evidence) ? q.evidence : [])
      .map(oneLine)
      .filter((id) => allowed.has(id));
    if (!text.endsWith('?') || text.length > MAX_TEXT_CHARS) {
      dropped.push(`not a short question: "${text.slice(0, 60)}"`);
    } else if (options.length < MIN_OPTIONS || options.length > MAX_OPTIONS) {
      dropped.push(`needs ${MIN_OPTIONS}–${MAX_OPTIONS} answers: "${text.slice(0, 60)}"`);
    } else if (options.some((o) => o.length > MAX_OPTION_CHARS)) {
      dropped.push(`an answer is too long: "${text.slice(0, 60)}"`);
    } else if (evidence.length === 0) {
      dropped.push(`cites no paper from today: "${text.slice(0, 60)}"`);
    } else {
      questions.push({ id: `q${questions.length + 1}`, text, options, evidence });
    }
  }
  return { questions, dropped };
}
