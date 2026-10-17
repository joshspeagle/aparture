import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import FullReportSidePanel from '../../components/briefing/FullReportSidePanel.jsx';
import { parseMarkdownBlocks } from '../../components/briefing/MarkdownLite.jsx';

describe('FullReportSidePanel', () => {
  it('shows the full report content when open', () => {
    render(
      <FullReportSidePanel
        open
        onOpenChange={() => {}}
        title="Circuit-level analysis of reasoning"
        content="Full ~1200-word technical report text."
      />
    );
    expect(screen.getByText(/Full ~1200-word technical report text/)).toBeInTheDocument();
  });

  it('calls onOpenChange when the close button is clicked', async () => {
    const onOpenChange = vi.fn();
    render(<FullReportSidePanel open onOpenChange={onOpenChange} title="t" content="c" />);
    await userEvent.click(screen.getByRole('button', { name: /close/i }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('renders the report Markdown as structure instead of printing "## Summary"', () => {
    // The composeFullReport shape: "## Section\n\nbody" blocks.
    const content = [
      '## Summary',
      'The paper proposes **conditional mean flows** for `SBI`.',
      '## Key findings',
      '- Few-step densities\n- Comparable *error*',
      '## Limitations',
      '1. Invertibility is not guaranteed\n2. MCMC was slower',
    ].join('\n\n');
    render(<FullReportSidePanel open onOpenChange={() => {}} title="t" content={content} />);

    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByRole('heading', { name: 'Summary' })).toBeInTheDocument();
    expect(within(dialog).getByRole('heading', { name: 'Key findings' })).toBeInTheDocument();
    expect(dialog.textContent).not.toContain('##');
    expect(within(dialog).getAllByRole('listitem')).toHaveLength(4);
    expect(within(dialog).getByText('conditional mean flows').tagName).toBe('STRONG');
    expect(within(dialog).getByText('SBI').tagName).toBe('CODE');
    expect(within(dialog).getByText('error').tagName).toBe('EM');
    expect(dialog.querySelector('ol')).not.toBeNull();
  });

  it('never injects markup from the report text', () => {
    const content = '## <img src=x onerror="alert(1)">\n\n<script>alert(1)</script> text';
    render(<FullReportSidePanel open onOpenChange={() => {}} title="t" content={content} />);
    const dialog = screen.getByRole('dialog');
    expect(dialog.querySelector('script')).toBeNull();
    expect(dialog.querySelector('img')).toBeNull();
    expect(dialog.textContent).toContain('<script>alert(1)</script> text');
  });
});

describe('parseMarkdownBlocks', () => {
  it('splits headings, paragraphs and lists, joining soft-wrapped lines', () => {
    expect(parseMarkdownBlocks('## A\nline one\nline two\n\n- x\n  continued\n- y')).toEqual([
      { type: 'h', level: 2, text: 'A' },
      { type: 'p', text: 'line one line two' },
      { type: 'list', ordered: false, items: ['x continued', 'y'] },
    ]);
  });

  it('treats "a * b * c" and "*italic* text" lines as paragraphs, not bullets', () => {
    expect(parseMarkdownBlocks('a * b * c\n\n*italic* text')).toEqual([
      { type: 'p', text: 'a * b * c' },
      { type: 'p', text: '*italic* text' },
    ]);
  });
});
