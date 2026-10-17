import { describe, it, expect } from 'vitest';
import {
  editorQuestionsJsonSchema,
  renderEditorQuestionsPrompt,
  renderFeedbackLines,
  validateEditorQuestions,
} from '../../../lib/editorQuestions/questions.js';

const ok = {
  id: 'x',
  text: 'Two papers today lost points for benchmark-only evidence. Should that cost a paper its place?',
  options: ['Yes', 'Only for neural methods', 'No'],
  evidence: ['2610.00001'],
};

describe('validateEditorQuestions', () => {
  it('keeps well-formed questions grounded in the input and renumbers them', () => {
    const { questions, dropped } = validateEditorQuestions({ questions: [ok] }, ['2610.00001']);
    expect(dropped).toEqual([]);
    expect(questions).toEqual([{ ...ok, id: 'q1' }]);
  });

  it('drops questions that cite no paper from today, lack a "?", or have the wrong number of answers', () => {
    const { questions, dropped } = validateEditorQuestions(
      {
        questions: [
          { ...ok, evidence: ['2610.99999'] },
          { ...ok, text: 'Tell me more about your interests.' },
          { ...ok, options: ['Yes'] },
          { ...ok, options: ['a', 'b', 'c', 'd', 'e'] },
        ],
      },
      ['2610.00001']
    );
    expect(questions).toEqual([]);
    expect(dropped).toHaveLength(4);
  });

  it('stops at two questions and dedupes repeated answers', () => {
    const { questions, dropped } = validateEditorQuestions(
      { questions: [ok, { ...ok, options: ['Yes', 'Yes', 'No'] }, ok] },
      ['2610.00001']
    );
    expect(questions.map((q) => q.id)).toEqual(['q1', 'q2']);
    expect(questions[1].options).toEqual(['Yes', 'No']);
    expect(dropped).toEqual(['more than two questions']);
  });

  it('treats malformed output as no questions', () => {
    expect(validateEditorQuestions(null, []).questions).toEqual([]);
    expect(validateEditorQuestions({ questions: 'nope' }, []).questions).toEqual([]);
  });
});

describe('editor-questions prompt', () => {
  it('fills every slot, including answered questions so they are not asked again', () => {
    const out = renderEditorQuestionsPrompt(
      'P:{{profile}}|F:{{feedback}}|T:{{papers}}|N:{{nearMisses}}',
      {
        profile: 'I study stellar streams.',
        papers: [{ arxivId: '2610.00001', title: 'A  title', score: 7.25, pitch: 'Does X.' }],
        nearMisses: [],
        feedbackEvents: [{ type: 'answer', question: 'Gaia only?', answer: 'No' }],
      }
    );
    expect(out).toBe(
      'P:I study stellar streams.|F:- answered "Gaia only?" with "No"|T:- 2610.00001 "A title" (7.3): Does X.|N:(none)'
    );
  });

  it('says so when there is no feedback yet', () => {
    expect(renderFeedbackLines([])).toBe('(none yet)');
  });

  it('keeps the schema in the portable subset', () => {
    const json = JSON.stringify(editorQuestionsJsonSchema());
    for (const banned of ['minItems', 'maxItems', 'minLength', 'maxLength', 'pattern', 'anyOf']) {
      expect(json).not.toContain(banned);
    }
  });
});
