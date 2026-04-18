import { z } from 'zod';

const PaperCardSchema = z.object({
  arxivId: z.string().min(1),
  title: z.string().min(1),
  score: z.number().min(0).max(10),
  onelinePitch: z.string().min(1),
  whyMatters: z.string().min(1),
});

const ThemeSectionSchema = z.object({
  title: z.string().min(1),
  argument: z.string().min(1),
  paperIds: z.array(z.string()).min(1),
});

export const BriefingSchema = z.object({
  executiveSummary: z.string().min(1),
  themes: z.array(ThemeSectionSchema),
  papers: z.array(PaperCardSchema),
});

// Emit a plain JSON Schema for use in provider-native structured output.
// We write this by hand rather than auto-generating from zod because the
// provider schemas require stable shapes and limited features.
export function toJsonSchema() {
  return {
    type: 'object',
    required: ['executiveSummary', 'themes', 'papers'],
    properties: {
      executiveSummary: { type: 'string' },
      themes: {
        type: 'array',
        items: {
          type: 'object',
          required: ['title', 'argument', 'paperIds'],
          properties: {
            title: { type: 'string' },
            argument: { type: 'string' },
            paperIds: { type: 'array', items: { type: 'string' } },
          },
        },
      },
      papers: {
        type: 'array',
        items: {
          type: 'object',
          required: ['arxivId', 'title', 'score', 'onelinePitch', 'whyMatters'],
          properties: {
            arxivId: { type: 'string' },
            title: { type: 'string' },
            score: { type: 'number' },
            onelinePitch: { type: 'string' },
            whyMatters: { type: 'string' },
          },
        },
      },
    },
  };
}
