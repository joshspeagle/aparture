/**
 * Renders the suggest-profile prompt template with profile + feedback substitution.
 *
 * @param {string} template
 * @param {{profile: string, events: Array<object>}} inputs
 * @returns {string}
 */
export function renderSuggestPrompt(template, { profile, events }) {
  return template
    .replace('{{profile}}', profile ?? '')
    .replace('{{feedback}}', renderFeedbackSection(events ?? []));
}

function renderFeedbackSection(events) {
  const stars = events.filter((e) => e.type === 'star');
  const dismisses = events.filter((e) => e.type === 'dismiss');
  const paperComments = events.filter((e) => e.type === 'paper-comment');
  const generalComments = events.filter((e) => e.type === 'general-comment');

  const sections = [];

  if (stars.length > 0) {
    sections.push(`STARS (${stars.length}):`);
    for (const e of stars) {
      sections.push(formatPaperEvent(e));
    }
  }

  if (dismisses.length > 0) {
    sections.push(`DISMISSES (${dismisses.length}):`);
    for (const e of dismisses) {
      sections.push(formatPaperEvent(e));
    }
  }

  if (paperComments.length > 0) {
    sections.push(`PER-PAPER COMMENTS (${paperComments.length}):`);
    for (const e of paperComments) {
      sections.push(formatPaperEvent(e));
      if (e.text) sections.push(`  Comment: "${e.text}"`);
    }
  }

  if (generalComments.length > 0) {
    sections.push(`GENERAL COMMENTS (${generalComments.length}):`);
    for (const e of generalComments) {
      sections.push(`- [${e.briefingDate}] "${e.text}"`);
    }
  }

  return sections.join('\n');
}

function formatPaperEvent(e) {
  const scoreStr = e.score !== undefined ? ` [score ${e.score}, briefing ${e.briefingDate}]` : '';
  const title = e.paperTitle ? ` "${e.paperTitle}"` : '';
  const summary = e.quickSummary ? `\n  Summary: ${e.quickSummary}` : '';
  return `- ${e.arxivId}${title}${scoreStr}${summary}`;
}
