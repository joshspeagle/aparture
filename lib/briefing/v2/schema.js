// Briefing v2: the newsletter-shaped briefing written by the agent skill
// (.claude/skills/aparture/references/briefing.md documents each field).
// Structural rules live here; grounding rules (ids resolve, quotes are
// verbatim) live in validate.js because they need the run's source texts.

import { z } from 'zod';

const nonEmpty = z.string().trim().min(1);

const PaperSchema = z
  .object({
    id: nonEmpty,
    title: nonEmpty,
    authors: nonEmpty,
    tier: z.enum(['read', 'skim', 'radar']),
    score: z.number().min(0).max(10),
    pitch: nonEmpty,
    whyYou: nonEmpty,
    result: z.object({ text: nonEmpty, quote: nonEmpty }).strict(),
    method: nonEmpty,
    caveat: nonEmpty,
    figure: z.object({ id: nonEmpty, caption: nonEmpty }).strict().nullable(),
    readingMinutes: z.number().int().min(1).max(600),
    because: z.string().nullable(),
    becauseRefs: z.array(nonEmpty),
  })
  .strict();

const ProposalSchema = z
  .object({
    id: nonEmpty,
    target: z.enum(['profile', 'learned']),
    edit: z
      .object({
        type: z.enum(['insert', 'replace', 'delete']),
        anchor: z.string(),
        content: z.string(),
      })
      .strict(),
    rationale: nonEmpty,
    evidence: z.array(nonEmpty).min(1),
  })
  .strict();

export const BriefingV2Schema = z
  .object({
    version: z.literal(2),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    headline: nonEmpty,
    lede: nonEmpty,
    readFirst: z.object({ id: nonEmpty, why: nonEmpty }).strict(),
    themes: z
      .array(
        z
          .object({ title: nonEmpty, argument: nonEmpty, paperIds: z.array(nonEmpty).min(1) })
          .strict()
      )
      .min(1)
      .max(6),
    papers: z.array(PaperSchema).min(1),
    nearMisses: z.array(z.object({ id: nonEmpty, line: nonEmpty }).strict()),
    notes: z
      .object({
        learned: z.string(),
        questions: z
          .array(
            z
              .object({
                id: nonEmpty,
                text: nonEmpty,
                options: z.array(nonEmpty).min(2).max(4),
              })
              .strict()
          )
          .max(3),
        proposals: z.array(ProposalSchema).max(3),
      })
      .strict(),
  })
  .strict();
