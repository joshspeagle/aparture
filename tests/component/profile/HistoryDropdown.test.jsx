import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import HistoryDropdown from '../../../components/profile/HistoryDropdown.jsx';

describe('HistoryDropdown', () => {
  const sampleRevisions = [
    {
      content: 'v2 content',
      createdAt: 1700000000000,
      source: 'manual',
      lastFeedbackCutoff: 0,
    },
    {
      content: 'v1 content',
      createdAt: 1699900000000,
      source: 'suggested',
      lastFeedbackCutoff: 0,
      rationale: 'Added bullet on mechanistic interpretability',
    },
  ];

  it('starts collapsed with a History trigger button', () => {
    render(<HistoryDropdown revisions={sampleRevisions} onRevert={() => {}} />);
    expect(screen.getByRole('button', { name: /history/i })).toBeInTheDocument();
    // Content should not be visible when collapsed
    expect(screen.queryByText('v2 content')).toBeNull();
  });

  it('expands when the trigger is clicked', () => {
    render(<HistoryDropdown revisions={sampleRevisions} onRevert={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /history/i }));
    // Look for something only visible when expanded — the Revert buttons
    expect(screen.getAllByRole('button', { name: /revert/i })).toHaveLength(2);
  });

  it('renders source badges for each revision', () => {
    render(<HistoryDropdown revisions={sampleRevisions} onRevert={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /history/i }));
    expect(screen.getByText(/manual/i)).toBeInTheDocument();
    expect(screen.getByText(/suggested/i)).toBeInTheDocument();
  });

  it('renders the rationale text when present', () => {
    render(<HistoryDropdown revisions={sampleRevisions} onRevert={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /history/i }));
    expect(screen.getByText(/mechanistic interpretability/i)).toBeInTheDocument();
  });

  it('calls onRevert with createdAt when a Revert button is clicked', () => {
    const onRevert = vi.fn();
    render(<HistoryDropdown revisions={sampleRevisions} onRevert={onRevert} />);
    fireEvent.click(screen.getByRole('button', { name: /history/i }));
    // Click the first Revert button (should match the first revision)
    fireEvent.click(screen.getAllByRole('button', { name: /revert/i })[0]);
    expect(onRevert).toHaveBeenCalledWith(1700000000000);
  });

  // Each revision stores the text from BEFORE its change. The entry must show
  // the change it records: from its own text to the next newer one (the
  // current profile, for the newest).
  it('shows what each change did, not the text it replaced', () => {
    const { container } = render(
      <HistoryDropdown
        revisions={sampleRevisions}
        currentContent="v3 content"
        onRevert={() => {}}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /history/i }));
    const lineOf = (type) =>
      [...container.querySelectorAll(`[data-change="${type}"]`)].map((el) => el.textContent);

    fireEvent.click(screen.getAllByRole('button', { name: /expand change/i })[0]);
    expect(screen.getByText('What this change did')).toBeInTheDocument();
    expect(lineOf('removed')).toEqual(['−v2 content']);
    expect(lineOf('added')).toEqual(['+v3 content']);

    // The suggested change (rationale: "Added bullet…") turned v1 into v2.
    fireEvent.click(screen.getAllByRole('button', { name: /collapse change/i })[0]);
    fireEvent.click(screen.getAllByRole('button', { name: /expand change/i })[1]);
    expect(lineOf('removed')).toEqual(['−v1 content']);
    expect(lineOf('added')).toEqual(['+v2 content']);
  });

  it('summarizes each change and labels template, revert, and switch sources', () => {
    const revisions = [
      { content: 'a', createdAt: 3, source: 'revert', rationale: 'Reverted…' },
      { content: 'b', createdAt: 2, source: 'switch' },
      { content: '', createdAt: 1, source: 'template', rationale: 'Started from…' },
    ];
    render(<HistoryDropdown revisions={revisions} currentContent="a2" onRevert={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /history/i }));
    expect(screen.getByText('revert')).toBeInTheDocument();
    expect(screen.getByText('switch')).toBeInTheDocument();
    expect(screen.getByText('template')).toBeInTheDocument();
    // The template entry turned an empty profile into "b".
    expect(screen.getByText('1 line added')).toBeInTheDocument();
  });

  it('falls back to the earlier text when the newer text is unknown', () => {
    render(<HistoryDropdown revisions={sampleRevisions.slice(0, 1)} onRevert={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /history/i }));
    fireEvent.click(screen.getByRole('button', { name: /expand change/i }));
    expect(screen.getByText('Text before this change')).toBeInTheDocument();
    expect(screen.getByText('v2 content')).toBeInTheDocument();
  });

  it('shows empty state when revisions is empty', () => {
    render(<HistoryDropdown revisions={[]} onRevert={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /history/i }));
    expect(screen.getByText(/no revisions yet/i)).toBeInTheDocument();
  });
});
