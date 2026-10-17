// The agent skill (.claude/skills/aparture/) works from the app's prompts and
// runner by name: it quotes prompt sections, restates the score formula and
// banned words, and calls bin/aparture.mjs with flags. Nothing else fails
// when one side renames something the other relies on, so this suite does.

import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, realpathSync } from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(__dirname, '../..');
const SKILL_DIR = path.join(ROOT, '.claude/skills/aparture');

const skillFiles = [
  'SKILL.md',
  ...readdirSync(path.join(SKILL_DIR, 'references')).map((f) => `references/${f}`),
];
const skillText = skillFiles.map((f) => readFileSync(path.join(SKILL_DIR, f), 'utf8')).join('\n');
const prompt = (name) => readFileSync(path.join(ROOT, 'prompts', name), 'utf8');
const headings = (text) =>
  text
    .split('\n')
    .filter((line) => /^#{1,6} /.test(line))
    .map((line) => line.replace(/^#+ /, '').trim());

describe('prompt sections the skill reads', () => {
  // CLAUDE.md's Prompts section lists these as read by heading.
  it.each([
    ['synthesis.md', 'Style and voice'],
    ['synthesis.md', 'Sourcing discipline'],
    ['check-briefing.md', 'What counts as a hallucination'],
    ['check-briefing.md', 'Output schema'],
  ])('%s keeps its "%s" heading', (file, heading) => {
    expect(headings(prompt(file))).toContain(heading);
  });

  it('the skill still names the synthesis sections it reads', () => {
    expect(skillText).toContain('"Style and voice" and "Sourcing discipline" sections');
  });

  it('the rubrics keep the verdicts and the calibration paragraph the skill applies', () => {
    expect(skillText).toContain('YES / MAYBE / NO');
    for (const verdict of ['YES', 'MAYBE', 'NO']) {
      expect(prompt('rubric-filter.md')).toMatch(new RegExp(`\\b${verdict}\\b`));
    }
    expect(skillText).toContain('profile-aware quality calibration');
    for (const file of ['rubric-scoring.md', 'rubric-pdf.md']) {
      expect(prompt(file)).toContain('**Calibrate Quality strictness to the profile.**');
    }
  });

  // The skill restates the formula instead of quoting it, so a reweighting
  // in the rubrics would leave its triage and deep reads on the old weights.
  it('the skill restates the score formula with the rubrics’ weights', () => {
    const FORMULA = /Research Alignment × ([\d.]+)\)? \+ \(?Paper Quality × ([\d.]+)/g;
    const weights = (text) => [...text.matchAll(FORMULA)].map((m) => `${m[1]}+${m[2]}`);
    const fromRubrics = [
      ...weights(prompt('rubric-scoring.md')),
      ...weights(prompt('rubric-pdf.md')),
    ];
    const fromSkill = weights(skillText);
    expect(fromRubrics).toHaveLength(2);
    expect(fromSkill.length).toBeGreaterThan(0);
    expect(new Set([...fromRubrics, ...fromSkill]).size).toBe(1);
  });

  // CLAUDE.md harmony rule 5: change all five or none.
  it.each([
    'prompts/synthesis.md',
    'prompts/analyze-pdf-quick.md',
    'prompts/rubric-pdf.md',
    'prompts/notebooklm-discussion-guide.md',
    '.claude/skills/aparture/references/briefing.md',
  ])('%s names the banned words', (file) => {
    const text = readFileSync(path.join(ROOT, file), 'utf8');
    for (const word of ['novel', 'breakthrough', 'paradigm-shift']) {
      expect(text).toContain(word);
    }
  });
});

describe('runner calls in the skill', () => {
  const help = execFileSync(process.execPath, ['bin/aparture.mjs', 'help'], {
    cwd: ROOT,
    encoding: 'utf8',
  });
  // Each command's block in the help text starts at a two-space indent and
  // lists its flags.
  const flagsByCommand = new Map();
  let current = null;
  for (const line of help.split('\n')) {
    const start = line.match(/^ {2}([a-z]+)\s{2,}/);
    if (start) {
      current = new Set();
      flagsByCommand.set(start[1], current);
    }
    for (const flag of line.match(/--[a-z][a-z-]*/g) ?? []) current?.add(flag);
  }

  // Only code spans and fenced blocks are invocations; prose may mention
  // the runner in passing.
  const code = [...skillText.matchAll(/```[\s\S]*?```|`[^`\n]+`/g)]
    .map((m) => m[0])
    .join('\n')
    .replace(/\\\n\s*/g, ' ');
  const calls = [...code.matchAll(/node bin\/aparture\.mjs ([a-z]+)([^\n`]*)/g)].map((m) => ({
    command: m[1],
    flags: m[2].match(/--[a-z][a-z-]*/g) ?? [],
  }));

  it('finds the runner calls the skill makes', () => {
    expect(calls.map((c) => c.command)).toEqual(
      expect.arrayContaining(['fetch', 'enrich', 'validate', 'render', 'record', 'ingest'])
    );
  });

  it('every command and flag the skill passes is in the runner’s help', () => {
    for (const { command, flags } of calls) {
      expect(flagsByCommand.has(command), `unknown command: ${command}`).toBe(true);
      for (const flag of flags) {
        expect(flagsByCommand.get(command).has(flag), `${command} ${flag}`).toBe(true);
      }
    }
  });
});

describe('skill files', () => {
  it('every reference file the skill names exists', () => {
    const named = new Set([...skillText.matchAll(/references\/[a-z-]+\.md/g)].map((m) => m[0]));
    expect(named.size).toBeGreaterThan(0);
    for (const file of named) {
      expect(existsSync(path.join(SKILL_DIR, file)), file).toBe(true);
    }
  });

  it('.agents/skills/aparture resolves to the skill under .claude/', () => {
    expect(realpathSync(path.join(ROOT, '.agents/skills/aparture'))).toBe(realpathSync(SKILL_DIR));
  });
});
