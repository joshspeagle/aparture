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

  it('shows empty state when newFeedback is empty', () => {
    render(<SuggestDialog {...defaultProps} newFeedback={[]} />);
    expect(screen.getByText(/no new feedback/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /generate suggestion/i })).toBeDisabled();
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
    briefingModel: 'gemini-3.1-pro',
    provider: 'google',
    password: 'test',
    onAccept: vi.fn(),
  };

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('Apply on diff view calls onAccept with applied profile, joined rationale, and max cutoff', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        changes: [
          {
            id: 'c1',
            rationale: 'based on star on 2504.01234',
            edit: {
              type: 'insert',
              anchor: 'profile text',
              content: ' with added bullet',
            },
          },
        ],
      }),
    });
    vi.stubGlobal('fetch', fetchMock);
    const onAccept = vi.fn();
    const onClose = vi.fn();
    render(<SuggestDialog {...baseProps} onAccept={onAccept} onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: /generate suggestion/i }));
    await screen.findByText(/proposed changes/i);
    fireEvent.click(screen.getByRole('button', { name: /apply/i }));
    expect(onAccept).toHaveBeenCalled();
    const [applied, rationale, cutoff] = onAccept.mock.calls[0];
    expect(applied).toBe('original profile text with added bullet');
    expect(rationale).toContain('based on star on 2504.01234');
    expect(cutoff).toBe(1700000000500);
    expect(onClose).toHaveBeenCalled();
  });

  it('Cancel on diff view closes without calling onAccept', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        changes: [
          {
            id: 'c1',
            rationale: 'y',
            edit: {
              type: 'insert',
              anchor: 'original profile text',
              content: ' updated',
            },
          },
        ],
      }),
    });
    vi.stubGlobal('fetch', fetchMock);
    const onAccept = vi.fn();
    const onClose = vi.fn();
    render(<SuggestDialog {...baseProps} onAccept={onAccept} onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: /generate suggestion/i }));
    await screen.findByText(/proposed changes/i);
    fireEvent.click(screen.getByRole('button', { name: /^cancel$/i }));
    expect(onAccept).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it('Dismiss on noChangeReason view advances the cutoff with unchanged profile', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        changes: [],
        noChangeReason: 'Profile already covers these areas.',
      }),
    });
    vi.stubGlobal('fetch', fetchMock);
    const onAccept = vi.fn();
    const onClose = vi.fn();
    render(<SuggestDialog {...baseProps} onAccept={onAccept} onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: /generate suggestion/i }));
    await screen.findByText(/no profile changes suggested/i);
    fireEvent.click(screen.getByRole('button', { name: /^dismiss$/i }));
    expect(onAccept).toHaveBeenCalledWith(
      'original profile text', // UNCHANGED profile
      expect.stringContaining('No changes warranted'),
      1700000000500 // newest timestamp still advances cutoff
    );
    expect(onClose).toHaveBeenCalled();
  });

  it('Apply uses only the timestamps of selected events (not all events)', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        changes: [
          {
            id: 'c1',
            rationale: 'y',
            edit: {
              type: 'insert',
              anchor: 'original profile text',
              content: ' updated',
            },
          },
        ],
      }),
    });
    vi.stubGlobal('fetch', fetchMock);
    const onAccept = vi.fn();
    render(<SuggestDialog {...baseProps} onAccept={onAccept} />);
    // Uncheck the newest event (dismissEvent, timestamp 1700000000500)
    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[1]); // uncheck dismiss
    fireEvent.click(screen.getByRole('button', { name: /generate suggestion/i }));
    await screen.findByText(/proposed changes/i);
    fireEvent.click(screen.getByRole('button', { name: /apply/i }));
    // Newest cutoff should now be from the remaining selected events,
    // not 1700000000500 which was unchecked
    const [, , cutoff] = onAccept.mock.calls[0];
    expect(cutoff).toBe(1700000000001);
  });
});
