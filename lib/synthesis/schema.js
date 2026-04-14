import { z } from 'zod';

const FigureSchema = z.object({
  caption: z.string(),
  description: z.string(),
  page: z.number().int().optional(),
});

const PaperCardSchema = z.object({
  arxivId: z.string().min(1),
  title: z.string().min(1),
  score: z.number().min(0).max(10),
  onelinePitch: z.string().min(1),
  whyMatters: z.string().min(1),
  figures: z.array(FigureSchema).default([]),
  quickSummaryPath: z.string(),
  fullReportPath: z.string(),
});

const ThemeSectionSchema = z.object({
  title: z.string().min(1),
  argument: z.string().min(1),
  paperIds: z.array(z.string()).min(1),
});

const DebateBlockSchema = z.object({
  title: z.string().min(1),
  summary: z.string().min(1),
  paperIds: z.array(z.string()).min(2),
  stance: z.enum(['tension', 'builds-on', 'compromise']).default('tension'),
});

const LongitudinalConnectionSchema = z.object({
  summary: z.string().min(1),
  todayPaperId: z.string(),
  pastPaperId: z.string(),
  pastDate: z.string(),
});

const ProactiveQuestionSchema = z.object({
  question: z.string().min(1),
  proposedMemoryPatch: z.string().optional(),
});

export const BriefingSchema = z.object({
  executiveSummary: z.string().min(1),
  themes: z.array(ThemeSectionSchema),
  papers: z.array(PaperCardSchema),
  debates: z.array(DebateBlockSchema).default([]),
  longitudinal: z.array(LongitudinalConnectionSchema).default([]),
  proactiveQuestions: z.array(ProactiveQuestionSchema).default([]),
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
            figures: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  caption: { type: 'string' },
                  description: { type: 'string' },
                  page: { type: 'integer' },
                },
              },
            },
            quickSummaryPath: { type: 'string' },
            fullReportPath: { type: 'string' },
          },
        },
      },
      debates: {
        type: 'array',
        items: {
          type: 'object',
          required: ['title', 'summary', 'paperIds'],
          properties: {
            title: { type: 'string' },
            summary: { type: 'string' },
            paperIds: { type: 'array', items: { type: 'string' } },
            stance: { type: 'string', enum: ['tension', 'builds-on', 'compromise'] },
          },
        },
      },
      longitudinal: {
        type: 'array',
        items: {
          type: 'object',
          required: ['summary', 'todayPaperId', 'pastPaperId', 'pastDate'],
          properties: {
            summary: { type: 'string' },
            todayPaperId: { type: 'string' },
            pastPaperId: { type: 'string' },
            pastDate: { type: 'string' },
          },
        },
      },
      proactiveQuestions: {
        type: 'array',
        items: {
          type: 'object',
          required: ['question'],
          properties: {
            question: { type: 'string' },
            proposedMemoryPatch: { type: 'string' },
          },
        },
      },
    },
  };
}
