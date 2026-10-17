import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import SuggestDialog from '../../../components/profile/SuggestDialog.jsx';

describe('SuggestDialog — selection state', () => {
  const starEvent = {
    id: 'e1',
    type: 'star',
    arxivId: '2504.01234',
    paperTitle: 'Circuit analysis',
    quickSummary: 'summary',
    score: 9.2,
    timestamp: 1700000000000,
    briefingDate: '2026-04-10',
  };
  const dismissEvent = {
    id: 'e2',
    type: 'dismiss',
    arxivId: '2504.02345',
    paperTitle: 'Head pruning',
    quickSummary: 'summary',
    score: 6,
    timestamp: 1700000000001,
    briefingDate: '2026-04-10',
  };
  const generalEvent = {
    id: 'e3',
    type: 'general-comment',
    text: 'too much theory',
    timestamp: 1700000000002,
    briefingDate: '2026-04-11',
  };

  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    profile: 'current profile',
    newFeedback: [starEvent, dismissEvent, generalEvent],
    cap: { commentCap: 30 },
    briefingModel: 'gemini-3.1-pro',
    provider: 'google',
    password: 'test',
    onAccept: vi.fn(),
  };

  it('renders the dialog header when open', () => {
    render(<SuggestDialog {...defaultProps} />);
    expect(screen.getByText(/suggest profile improvements/i)).toBeInTheDocument();
  });

  it('renders nothing when isOpen is false', () => {
    render(<SuggestDialog {...defaultProps} isOpen={false} />);
    expect(screen.queryByText(/suggest profile improvements/i)).toBeNull();
  });

  it('renders one checkbox per feedback event', () => {
    render(<SuggestDialog {...defaultProps} />);
    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes).toHaveLength(3);
  });

  it('starts with all checkboxes checked', () => {
    render(<SuggestDialog {...defaultProps} />);
    const checkboxes = screen.getAllByRole('checkbox');
    checkboxes.forEach((cb) => expect(cb).toBeChecked());
  });

  it('allows unchecking individual events', () => {
    render(<SuggestDialog {...defaultProps} />);
    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[0]);
    expect(checkboxes[0]).not.toBeChecked();
    expect(checkboxes[1]).toBeChecked();
  });

  it('disables Generate when all items are unchecked', () => {
    render(<SuggestDialog {...defaultProps} />);
    const checkboxes = screen.getAllByRole('checkbox');
    checkboxes.forEach((cb) => fireEvent.click(cb));
    expect(screen.getByRole('button', { name: /generate suggestion/i })).toBeDisabled();
  });

  it('shows empty state when newFeedback is empty, with default clarity guidance pre-filled', () => {
    render(<SuggestDialog {...defaultProps} newFeedback={[]} />);
    expect(screen.getByText(/no recent feedback/i)).toBeInTheDocument();
    // Guidance is pre-filled with the default clarity prompt, so Generate is enabled immediately
    const textarea = screen.getByLabelText(/guidance/i);
    expect(textarea.value).toMatch(/sharpen the clarity/i);
    expect(screen.getByRole('button', { name: /generate suggestion/i })).not.toBeDisabled();
    // Clearing the textarea disables Generate (no signal at all)
    fireEvent.change(textarea, { target: { value: '' } });
    expect(screen.getByRole('button', { name: /generate suggestion/i })).toBeDisabled();
    // Re-typing custom guidance re-enables it
    fireEvent.change(textarea, { target: { value: 'clean up the profile' } });
    expect(screen.getByRole('button', { name: /generate suggestion/i })).not.toBeDisabled();
  });

  it('calls onClose when Cancel is clicked', () => {
    const onClose = vi.fn();
    render(<SuggestDialog {...defaultProps} onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('shows cap notice when cap trims items', () => {
    // Create 40 paper-comments so cap (30) will trim 10
    const manyComments = Array.from({ length: 40 }, (_, i) => ({
      id: `c${i}`,
      type: 'paper-comment',
      arxivId: `pc${i}`,
      paperTitle: `T${i}`,
      quickSummary: 's',
      score: 5,
      text: `comment ${i}`,
      timestamp: 1700000000000 + i,
      briefingDate: '2026-04-10',
    }));
    render(<SuggestDialog {...defaultProps} newFeedback={manyComments} />);
    expect(screen.getByText(/older comments will not be included/i)).toBeInTheDocument();
  });

  it('does not show cap notice when nothing would be trimmed', () => {
    render(<SuggestDialog {...defaultProps} />);
    expect(screen.queryByText(/older comments will not be included/i)).toBeNull();
  });
});

describe('SuggestDialog — loading and result states', () => {
  const starEvent = {
    id: 'e1',
    type: 'star',
    arxivId: '2504.01234',
    paperTitle: 'Circuit analysis',
    quickSummary: 'summary',
    score: 9.2,
    timestamp: 1700000000000,
    briefingDate: '2026-04-10',
  };
  const dismissEvent = {
    id: 'e2',
    type: 'dismiss',
    arxivId: '2504.02345',
    paperTitle: 'Head pruning',
    quickSummary: 'summary',
    score: 6,
    timestamp: 1700000000001,
    briefingDate: '2026-04-10',
  };
  const generalEvent = {
    id: 'e3',
    type: 'general-comment',
    text: 'too much theory',
    timestamp: 1700000000002,
    briefingDate: '2026-04-11',
  };

  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    profile: 'current profile',
    newFeedback: [starEvent, dismissEvent, generalEvent],
    cap: { commentCap: 30 },
    briefingModel: 'gemini-3.1-pro',
    provider: 'google',
    password: 'test',
    onAccept: vi.fn(),
  };

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('transitions to loading state when Generate is clicked and the API is pending', async () => {
    const fetchMock = vi.fn().mockReturnValue(new Promise(() => {})); // never resolves
    vi.stubGlobal('fetch', fetchMock);
    render(<SuggestDialog {...defaultProps} />);
    fireEvent.click(screen.getByRole('button', { name: /generate suggestion/i }));
    expect(await screen.findByText(/asking/i)).toBeInTheDocument();
  });

  it('renders DiffPreview when the API returns changes', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        changes: [
          {
            id: 'c1',
            rationale: 'stars showed interest',
            edit: {
              type: 'insert',
              anchor: 'current profile',
              content: ' with new bullet',
            },
          },
        ],
      }),
    });
    vi.stubGlobal('fetch', fetchMock);
    render(<SuggestDialog {...defaultProps} />);
    fireEvent.click(screen.getByRole('button', { name: /generate suggestion/i }));
    expect(await screen.findByText(/proposed changes/i)).toBeInTheDocument();
    expect(screen.getByText(/1\)|proposed changes \(1\)/i)).toBeInTheDocument();
  });

  it('renders the noChangeReason view when the API returns no changes', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        changes: [],
        noChangeReason: 'Profile already covers these areas.',
      }),
    });
    vi.stubGlobal('fetch', fetchMock);
    render(<SuggestDialog {...defaultProps} />);
    fireEvent.click(screen.getByRole('button', { name: /generate suggestion/i }));
    expect(await screen.findByText(/no profile changes suggested/i)).toBeInTheDocument();
    expect(screen.getByText(/profile already covers these areas/i)).toBeInTheDocument();
  });

  it('shows an error banner when the API call fails', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 500 });
    vi.stubGlobal('fetch', fetchMock);
    render(<SuggestDialog {...defaultProps} />);
    fireEvent.click(screen.getByRole('button', { name: /generate suggestion/i }));
    expect(await screen.findByText(/suggestion failed/i)).toBeInTheDocument();
    // Should be back in selection state
    expect(screen.getAllByRole('checkbox')).toHaveLength(3);
  });

  it('passes selected events in the API request body', async () => {
    let capturedBody = null;
    const fetchMock = vi.fn().mockImplementation((url, opts) => {
      capturedBody = JSON.parse(opts.body);
      return Promise.resolve({
        ok: true,
        json: async () => ({ changes: [] }),
      });
    });
    vi.stubGlobal('fetch', fetchMock);
    render(<SuggestDialog {...defaultProps} />);
    // Uncheck the second event
    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[1]);
    fireEvent.click(screen.getByRole('button', { name: /generate suggestion/i }));
    await screen.findByText(/no profile changes suggested|proposed changes/i);
    expect(capturedBody.feedback).toHaveLength(2);
  });
});

// Regression: the comment cap must actually trim the POST body, not just the
// displayed "N older comments will not be included" notice. Previously the
// notice was display-only and the dropped comments were still sent.
describe('SuggestDialog — comment cap is applied to the POST body, not display-only', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('sends only the most-recent `cap` comments while retaining all high-signal events', async () => {
    const cap = { commentCap: 10 };

    // 40 paper-comments (cap will keep the newest 10) ...
    const paperComments = Array.from({ length: 40 }, (_, i) => ({
      id: `pc${i}`,
      type: 'paper-comment',
      arxivId: `2504.${1000 + i}`,
      paperTitle: `Paper ${i}`,
      quickSummary: 's',
      score: 5,
      text: `paper comment ${i}`,
      timestamp: 1_700_000_000_000 + i, // increasing → newest are the highest i
      briefingDate: '2026-04-10',
    }));
    // ... 25 general-comments (cap will keep the newest 10) ...
    const generalComments = Array.from({ length: 25 }, (_, i) => ({
      id: `gc${i}`,
      type: 'general-comment',
      text: `general comment ${i}`,
      timestamp: 1_700_000_100_000 + i,
      briefingDate: '2026-04-11',
    }));
    // ... plus high-signal events that must NEVER be capped.
    const stars = Array.from({ length: 15 }, (_, i) => ({
      id: `star${i}`,
      type: 'star',
      arxivId: `2505.${1000 + i}`,
      paperTitle: `Star ${i}`,
      quickSummary: 's',
      score: 9,
      timestamp: 1_700_000_200_000 + i,
      briefingDate: '2026-04-12',
    }));
    const dismisses = Array.from({ length: 12 }, (_, i) => ({
      id: `dis${i}`,
      type: 'dismiss',
      arxivId: `2506.${1000 + i}`,
      paperTitle: `Dismiss ${i}`,
      quickSummary: 's',
      score: 3,
      timestamp: 1_700_000_300_000 + i,
      briefingDate: '2026-04-12',
    }));
    const scoped = [
      {
        id: 'scoped0',
        type: 'scoped-feedback',
        scope: { kind: 'score-review' },
        text: 'too lenient this round',
        timestamp: 1_700_000_400_000,
        briefingDate: '2026-04-12',
      },
    ];
    const overrides = [
      {
        id: 'ovr0',
        type: 'filter-override',
        arxivId: '2507.0001',
        originalVerdict: 'NO',
        newVerdict: 'YES',
        timestamp: 1_700_000_500_000,
        briefingDate: '2026-04-12',
      },
    ];

    const newFeedback = [
      ...paperComments,
      ...generalComments,
      ...stars,
      ...dismisses,
      ...scoped,
      ...overrides,
    ];

    let capturedBody = null;
    const fetchMock = vi.fn().mockImplementation((url, opts) => {
      capturedBody = JSON.parse(opts.body);
      return Promise.resolve({ ok: true, json: async () => ({ changes: [] }) });
    });
    vi.stubGlobal('fetch', fetchMock);

    render(
      <SuggestDialog
        isOpen
        onClose={vi.fn()}
        profile="current profile"
        newFeedback={newFeedback}
        cap={cap}
        briefingModel="gemini-3.1-pro"
        provider="google"
        password="test"
        onAccept={vi.fn()}
      />
    );

    // The notice should advertise exactly the count we expect to be dropped:
    // (40 - 10) paper + (25 - 10) general = 45 comments not included.
    expect(screen.getByText(/45 older comments will not be included/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /generate suggestion/i }));
    await screen.findByText(/no profile changes suggested|proposed changes/i);

    const sent = capturedBody.feedback;
    const byType = (t) => sent.filter((e) => e.type === t);

    // Comments are trimmed to the cap...
    expect(byType('paper-comment')).toHaveLength(10);
    expect(byType('general-comment')).toHaveLength(10);
    // ...and the trimmed comments are the MOST-RECENT ones (ids pc30..pc39).
    const keptPaperIds = byType('paper-comment')
      .map((e) => e.id)
      .sort();
    expect(keptPaperIds).toEqual(Array.from({ length: 10 }, (_, i) => `pc${30 + i}`).sort());

    // High-signal events are retained uncapped.
    expect(byType('star')).toHaveLength(15);
    expect(byType('dismiss')).toHaveLength(12);
    expect(byType('scoped-feedback')).toHaveLength(1);
    expect(byType('filter-override')).toHaveLength(1);

    // Total sent = 10 + 10 + 15 + 12 + 1 + 1 = 49, NOT the raw 94.
    expect(sent).toHaveLength(49);
    // The dropped count claimed by the notice matches reality: 94 raw − 49 sent.
    expect(newFeedback.length - sent.length).toBe(45);
  });
});

describe('SuggestDialog — close/reopen lifecycle', () => {
  const starEvent = {
    id: 'e1',
    type: 'star',
    arxivId: '2504.01234',
    paperTitle: 'Circuit analysis',
    quickSummary: 'summary',
    score: 9.2,
    timestamp: 1700000000000,
    briefingDate: '2026-04-10',
  };

  const baseProps = {
    onClose: vi.fn(),
    profile: 'current profile',
    newFeedback: [starEvent],
    cap: { commentCap: 30 },
    briefingModel: 'gemini-3.1-pro',
    provider: 'google',
    password: 'test',
    onAccept: vi.fn(),
  };

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('resets a stale error when the dialog is reopened', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 500 });
    vi.stubGlobal('fetch', fetchMock);
    const { rerender } = render(<SuggestDialog {...baseProps} isOpen={true} />);
    fireEvent.click(screen.getByRole('button', { name: /generate suggestion/i }));
    expect(await screen.findByText(/suggestion failed/i)).toBeInTheDocument();

    // Close, then reopen — the stale error banner must not reappear.
    rerender(<SuggestDialog {...baseProps} isOpen={false} />);
    rerender(<SuggestDialog {...baseProps} isOpen={true} />);
    expect(screen.queryByText(/suggestion failed/i)).toBeNull();
    expect(screen.getByRole('button', { name: /generate suggestion/i })).toBeInTheDocument();
  });

  it('aborts the in-flight request when the dialog closes during loading and reopens in selection state', async () => {
    let capturedSignal = null;
    const fetchMock = vi.fn().mockImplementation(
      (url, opts) =>
        new Promise((_, reject) => {
          capturedSignal = opts.signal;
          opts.signal.addEventListener('abort', () =>
            reject(new DOMException('Aborted', 'AbortError'))
          );
        })
    );
    vi.stubGlobal('fetch', fetchMock);
    const { rerender } = render(<SuggestDialog {...baseProps} isOpen={true} />);
    fireEvent.click(screen.getByRole('button', { name: /generate suggestion/i }));
    expect(await screen.findByText(/asking/i)).toBeInTheDocument();
    expect(capturedSignal).not.toBeNull();
    expect(capturedSignal.aborted).toBe(false);

    // Close while loading: the fetch is aborted...
    rerender(<SuggestDialog {...baseProps} isOpen={false} />);
    expect(capturedSignal.aborted).toBe(true);

    // ...and reopening shows the selection state, not a stale loading/error view.
    rerender(<SuggestDialog {...baseProps} isOpen={true} />);
    expect(await screen.findByRole('button', { name: /generate suggestion/i })).toBeInTheDocument();
    expect(screen.queryByText(/asking/i)).toBeNull();
    expect(screen.queryByText(/suggestion failed/i)).toBeNull();
  });
});

describe('SuggestDialog — accept/reject/dismiss', () => {
  const starEvent = {
    id: 'e1',
    type: 'star',
    arxivId: '2504.01234',
    paperTitle: 'T1',
    quickSummary: 's',
    score: 9.2,
    timestamp: 1700000000000,
    briefingDate: '2026-04-10',
  };
  const dismissEvent = {
    id: 'e2',
    type: 'dismiss',
    arxivId: '2504.02345',
    paperTitle: 'T2',
    quickSummary: 's',
    score: 6,
    timestamp: 1700000000500, // newest of the sample
    briefingDate: '2026-04-10',
  };
  const generalEvent = {
    id: 'e3',
    type: 'general-comment',
    text: 'too much theory',
    timestamp: 1700000000001,
    briefingDate: '2026-04-11',
  };

  const baseProps = {
    isOpen: true,
    onClose: vi.fn(),
    profile: 'original profile text',
    newFeedback: [starEvent, dismissEvent, generalEvent],
    cap: { commentCap: 30 },
    briefingModel: 'gemini-3.6-flash',
    provider: 'google',
    password: 'test',
    onAccept: vi.fn(),
  };

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const respondWith = (body) => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => body });
    vi.stubGlobal('fetch', fetchMock);
    return fetchMock;
  };

  // c1 cites the star; c2 cites the dismiss.
  const twoChanges = {
    changes: [
      {
        id: 'c1',
        rationale: 'Based on the star on 2504.01234, added the bullet.',
        edit: { type: 'insert', anchor: 'profile text', content: ' with added bullet' },
      },
      {
        id: 'c2',
        rationale: 'The dismiss on 2504.02345 suggests dropping "original".',
        edit: { type: 'delete', anchor: 'original ', content: '' },
      },
    ],
  };

  async function generate(props = {}) {
    render(<SuggestDialog {...baseProps} {...props} />);
    fireEvent.click(screen.getByRole('button', { name: /generate suggestion/i }));
  }

  it('Apply hands App one outcome: new content, accepted rationale, cited events only', async () => {
    respondWith(twoChanges);
    const onAccept = vi.fn();
    const onClose = vi.fn();
    await generate({ onAccept, onClose });
    await screen.findByText(/proposed changes/i);
    // Reject c2, keep c1.
    const changeBoxes = screen.getAllByRole('checkbox');
    fireEvent.click(changeBoxes[1]);
    fireEvent.click(screen.getByRole('button', { name: /apply 1 of 2/i }));

    expect(onAccept).toHaveBeenCalledTimes(1);
    const outcome = onAccept.mock.calls[0][0];
    expect(outcome.kind).toBe('applied');
    expect(outcome.content).toBe('original profile text with added bullet');
    expect(outcome.rationale).toContain('star on 2504.01234');
    expect(outcome.accepted.map((c) => c.id)).toEqual(['c1']);
    expect(outcome.rejected.map((c) => c.id)).toEqual(['c2']);
    // The star motivated the accepted change; the dismiss sits behind the
    // REJECTED change and stays pending. The general comment informed a
    // revision the user accepted and no rejected rationale quotes it.
    expect(outcome.incorporatedEventIds.sort()).toEqual(['e1', 'e3']);
    expect(typeof outcome.appliedAt).toBe('number');
    expect(onClose).toHaveBeenCalled();
  });

  it('an unticked event is never sent and never marked incorporated (P1-4)', async () => {
    const fetchMock = respondWith(twoChanges);
    const onAccept = vi.fn();
    render(<SuggestDialog {...baseProps} onAccept={onAccept} />);
    // Untick the star (an OLDER event than the dismiss): with the old
    // max-timestamp cutoff it was marked "Already incorporated" forever.
    fireEvent.click(screen.getAllByRole('checkbox')[0]);
    fireEvent.click(screen.getByRole('button', { name: /generate suggestion/i }));
    await screen.findByText(/proposed changes/i);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).feedback.map((e) => e.id)).toEqual([
      'e2',
      'e3',
    ]);
    fireEvent.click(screen.getByRole('button', { name: /apply 2 of 2/i }));
    const outcome = onAccept.mock.calls[0][0];
    // c1 still cites 2504.01234, but that event wasn't sent this time.
    expect(outcome.incorporatedEventIds).not.toContain('e1');
    expect(outcome.incorporatedEventIds.sort()).toEqual(['e2', 'e3']);
  });

  it('Cancel on diff view closes without calling onAccept', async () => {
    respondWith(twoChanges);
    const onAccept = vi.fn();
    const onClose = vi.fn();
    await generate({ onAccept, onClose });
    await screen.findByText(/proposed changes/i);
    fireEvent.click(screen.getByRole('button', { name: /^cancel$/i }));
    expect(onAccept).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it('Dismiss on the no-change view incorporates nothing and keeps the profile', async () => {
    respondWith({ changes: [], noChangeReason: 'Profile already covers these areas.' });
    const onAccept = vi.fn();
    const onClose = vi.fn();
    await generate({ onAccept, onClose });
    await screen.findByText(/no profile changes suggested/i);
    fireEvent.click(screen.getByRole('button', { name: /^dismiss$/i }));
    const outcome = onAccept.mock.calls[0][0];
    expect(outcome).toMatchObject({
      kind: 'no-change',
      noChangeReason: 'Profile already covers these areas.',
      incorporatedEventIds: [],
    });
    // No new content: nothing for App to save as a revision.
    expect(outcome.content).toBeUndefined();
    expect(onClose).toHaveBeenCalled();
  });

  it('Reject all records every change as rejected and incorporates nothing (P1-5)', async () => {
    respondWith(twoChanges);
    const onAccept = vi.fn();
    await generate({ onAccept });
    await screen.findByText(/proposed changes/i);
    fireEvent.click(screen.getByText(/select none/i));
    fireEvent.click(screen.getByRole('button', { name: /reject all 2 changes/i }));
    const outcome = onAccept.mock.calls[0][0];
    expect(outcome.kind).toBe('rejected');
    expect(outcome.accepted).toEqual([]);
    expect(outcome.rejected.map((c) => c.id)).toEqual(['c1', 'c2']);
    expect(outcome.incorporatedEventIds).toEqual([]);
  });

  it('sends remembered rejections after the feedback events and says so (P1-5)', async () => {
    const fetchMock = respondWith({ changes: [], noChangeReason: 'covered' });
    const rejectedSuggestions = [
      {
        rationale: 'stars on lensing',
        edit: { type: 'insert', anchor: 'Methods:', content: ' strong lensing.' },
        rejectedAt: 1700000000000,
      },
    ];
    render(<SuggestDialog {...baseProps} rejectedSuggestions={rejectedSuggestions} />);
    expect(screen.getByTestId('rejected-suggestions-note')).toHaveTextContent(
      /1 change you rejected earlier is sent with this request/i
    );
    fireEvent.click(screen.getByRole('button', { name: /generate suggestion/i }));
    await screen.findByText(/no profile changes suggested/i);
    const sent = JSON.parse(fetchMock.mock.calls[0][1].body).feedback;
    expect(sent.map((e) => e.type)).toEqual([
      'star',
      'dismiss',
      'general-comment',
      'rejected-suggestion',
    ]);
    expect(sent[3]).toMatchObject({
      rationale: 'stars on lensing',
      edit: { type: 'insert', anchor: 'Methods:', content: ' strong lensing.' },
    });
  });
});
