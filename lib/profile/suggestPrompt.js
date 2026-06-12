/**
 * Renders the suggest-profile prompt template with profile + feedback substitution.
 *
 * @param {string} template
 * @param {{profile: string, events: Array<object>, briefings?: object, guidance?: string}} inputs
 * @returns {string}
 */
export function renderSuggestPrompt(template, { profile, events, briefings, guidance }) {
  const body = template
    .replace('{{profile}}', () => profile ?? '')
    .replace('{{feedback}}', () => renderFeedbackSection(events ?? [], briefings ?? {}));
  return prependGuidance(body, guidance);
}

function prependGuidance(body, guidance) {
  const g = (guidance ?? '').trim();
  if (!g) return body;
  const guidanceBlock = [
    'USER GUIDANCE FOR THIS CALL:',
    `"${g}"`,
    '',
    'Treat the guidance above as the strongest signal you receive in this call. If it',
    'conflicts with the pattern suggested by raw feedback events below, follow the',
    'guidance. If the guidance is vague, use the feedback events to ground concrete',
    'edits that move the profile in the direction the guidance describes.',
    '',
  ].join('\n');
  return `${guidanceBlock}\n${body}`;
}

/**
 * Pairs paper-comment events with filter-override events on the same (arxivId, briefingDate).
 *
 * Rules:
 * - Multiple comments + one override on same key: include ALL comments chronologically.
 * - Multiple overrides on same key: most recent is canonical; earlier ones go to standaloneOverrides.
 * - Different briefingDates do NOT pair.
 *
 * @param {Array<object>} events
 * @returns {{ pairedOverrides: Array<{override: object, comments: Array<object>}>, standaloneComments: Array<object>, standaloneOverrides: Array<object> }}
 */
export function pairCommentsWithOverrides(events) {
  const comments = events.filter((e) => e.type === 'paper-comment');
  const overrides = events.filter((e) => e.type === 'filter-override');

  const commentsByKey = new Map();
  for (const c of comments) {
    const key = `${c.arxivId}|${c.briefingDate}`;
    if (!commentsByKey.has(key)) commentsByKey.set(key, []);
    commentsByKey.get(key).push(c);
  }
  for (const [, list] of commentsByKey) {
    list.sort((a, b) => a.timestamp - b.timestamp);
  }

  const overridesByKey = new Map();
  for (const o of overrides) {
    const key = `${o.arxivId}|${o.briefingDate}`;
    if (!overridesByKey.has(key)) overridesByKey.set(key, []);
    overridesByKey.get(key).push(o);
  }

  const pairedOverrides = [];
  const standaloneOverrides = [];

  for (const [key, list] of overridesByKey) {
    list.sort((a, b) => a.timestamp - b.timestamp);
    const canonical = list[list.length - 1];
    const earlier = list.slice(0, -1);
    standaloneOverrides.push(...earlier);

    const matchingComments = commentsByKey.get(key);
    if (matchingComments && matchingComments.length > 0) {
      pairedOverrides.push({ override: canonical, comments: matchingComments });
      commentsByKey.delete(key);
    } else {
      standaloneOverrides.push(canonical);
    }
  }

  const standaloneComments = [];
  for (const [, list] of commentsByKey) {
    standaloneComments.push(...list);
  }

  return { pairedOverrides, standaloneComments, standaloneOverrides };
}

function renderFeedbackSection(events, briefings) {
  const stars = events.filter((e) => e.type === 'star');
  const dismisses = events.filter((e) => e.type === 'dismiss');
  const generalComments = events.filter((e) => e.type === 'general-comment');
  const scopedFeedback = events.filter((e) => e.type === 'scoped-feedback');
  const bucketEvents = scopedFeedback.filter((e) => e.scope.kind === 'bucket');
  const scoreReviewEvents = scopedFeedback.filter((e) => e.scope.kind === 'score-review');
  const runEvents = scopedFeedback.filter((e) => e.scope.kind === 'run');

  const { pairedOverrides, standaloneComments, standaloneOverrides } =
    pairCommentsWithOverrides(events);

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

  if (standaloneComments.length > 0) {
    sections.push(`PER-PAPER COMMENTS (${standaloneComments.length}):`);
    for (const e of [...standaloneComments].sort((a, b) => a.timestamp - b.timestamp)) {
      sections.push(formatPaperEvent(e));
      if (e.text) sections.push(`  Comment: "${e.text}"`);
    }
  }

  if (generalComments.length > 0) {
    sections.push(`GENERAL COMMENTS (${generalComments.length}):`);
    for (const e of generalComments) {
      sections.push(`- [${e.briefingDate}] "${e.text}"`);
      const briefing = e.briefingId ? briefings?.[e.briefingId] : null;
      if (briefing) {
        sections.push(...renderBriefingContext(briefing));
      }
    }
  }

  const totalOverrides = standaloneOverrides.length + pairedOverrides.length;
  if (totalOverrides > 0) {
    sections.push(`FILTER OVERRIDES (${totalOverrides}, with rationale where given):`);
    for (const o of standaloneOverrides.sort((a, b) => a.timestamp - b.timestamp)) {
      const title = o.paperTitle ? ` "${o.paperTitle}"` : '';
      sections.push(`- ${o.arxivId}${title} — overrode ${o.originalVerdict} → ${o.newVerdict}`);
      if (o.summary) sections.push(`  Filter summary: ${o.summary}`);
      if (o.justification) sections.push(`  Filter justification: ${o.justification}`);
    }
    for (const { override, comments } of pairedOverrides) {
      const title = override.paperTitle ? ` "${override.paperTitle}"` : '';
      const commentList = comments.map((c) => `  - "${c.text}"`).join('\n');
      sections.push(
        `- ${override.arxivId}${title} — overrode ${override.originalVerdict} → ${override.newVerdict}, with comments:\n${commentList}`
      );
    }
  }

  if (bucketEvents.length > 0) {
    sections.push(
      `BUCKET-LEVEL OBSERVATIONS (${bucketEvents.length}):\n` +
        bucketEvents
          .sort((a, b) => a.timestamp - b.timestamp)
          .map((e) => `- [${e.briefingDate}] ${e.scope.bucket} bucket: "${e.text}"`)
          .join('\n')
    );
  }

  if (scoreReviewEvents.length > 0) {
    sections.push(
      `SCORE-REVIEW NOTES (${scoreReviewEvents.length}):\n` +
        scoreReviewEvents
          .sort((a, b) => a.timestamp - b.timestamp)
          .map((e) => `- [${e.briefingDate}] "${e.text}"`)
          .join('\n')
    );
  }

  if (runEvents.length > 0) {
    sections.push(
      `RUN-LEVEL OBSERVATIONS (${runEvents.length}):\n` +
        runEvents
          .sort((a, b) => a.timestamp - b.timestamp)
          .map((e) => `- [${e.briefingDate}] "${e.text}"`)
          .join('\n')
    );
  }

  return sections.join('\n');
}

function renderBriefingContext(briefing) {
  const lines = ['  ┆ Briefing this comment was written against:'];
  if (briefing.executiveSummary) {
    lines.push('  ┆   Executive summary:');
    for (const para of briefing.executiveSummary.split(/\n+/).filter(Boolean)) {
      lines.push(`  ┆     ${para.trim()}`);
    }
  }
  if (Array.isArray(briefing.themes) && briefing.themes.length > 0) {
    lines.push('  ┆   Themes:');
    for (const theme of briefing.themes) {
      if (theme.title) lines.push(`  ┆     - ${theme.title}`);
      if (theme.argument) lines.push(`  ┆       ${theme.argument}`);
    }
  }
  if (Array.isArray(briefing.papers) && briefing.papers.length > 0) {
    lines.push('  ┆   Papers in this briefing:');
    for (const p of briefing.papers) {
      const title = p.title ? ` "${p.title}"` : '';
      const pitch = p.onelinePitch ? ` — ${p.onelinePitch}` : '';
      lines.push(`  ┆     - ${p.arxivId}${title}${pitch}`);
    }
  }
  return lines;
}

function formatPaperEvent(e) {
  const scoreStr = e.score !== undefined ? ` [score ${e.score}, briefing ${e.briefingDate}]` : '';
  const title = e.paperTitle ? ` "${e.paperTitle}"` : '';
  const summary = e.quickSummary ? `\n  Summary: ${e.quickSummary}` : '';
  return `- ${e.arxivId}${title}${scoreStr}${summary}`;
}

/**
 * Validates that a set of text edits are non-overlapping in the base text
 * and that all anchors exist. Returns {ok: true} on success, or
 * {ok: false, overlappingIds?: string[], missingAnchors?: string[]} on failure.
 *
 * @param {Array<{id: string, edit: {type: 'replace'|'insert'|'delete', anchor: string, content?: string}}>} changes
 * @param {string} baseText
 * @returns {{ok: true} | {ok: false, overlappingIds?: string[], missingAnchors?: string[]}}
 */
export function validateNonOverlappingChanges(changes, baseText) {
  const ranges = [];
  const missingAnchors = [];

  for (const change of changes) {
    const { id, edit } = change;
    if (edit.type === 'insert') {
      const idx = baseText.indexOf(edit.anchor);
      if (idx < 0) {
        missingAnchors.push(id);
        continue;
      }
      // Insert is a point; represent as zero-length range after anchor.
      ranges.push({ id, start: idx + edit.anchor.length, end: idx + edit.anchor.length });
    } else if (edit.type === 'replace' || edit.type === 'delete') {
      const idx = baseText.indexOf(edit.anchor);
      if (idx < 0) {
        missingAnchors.push(id);
        continue;
      }
      ranges.push({ id, start: idx, end: idx + edit.anchor.length });
    }
  }

  if (missingAnchors.length > 0) {
    return { ok: false, missingAnchors };
  }

  ranges.sort((a, b) => a.start - b.start);
  for (let i = 1; i < ranges.length; i++) {
    if (ranges[i].start < ranges[i - 1].end) {
      return { ok: false, overlappingIds: [ranges[i - 1].id, ranges[i].id] };
    }
  }
  return { ok: true };
}
