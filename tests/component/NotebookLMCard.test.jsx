import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import NotebookLMCard from '../../components/notebooklm/NotebookLMCard.jsx';

const baseProps = {
  podcastDuration: 20,
  setPodcastDuration: () => {},
  notebookLMModel: 'gemini-3.1-pro',
  setNotebookLMModel: () => {},
  notebookLMGenerating: false,
  notebookLMStatus: '',
  notebookLMContent: null,
  onGenerateNotebookLM: vi.fn(),
  processing: { isRunning: false },
  currentBriefing: { id: 'x', briefing: {} },
};

describe('NotebookLMCard', () => {
  it('renders the simplified generate button', () => {
    render(<NotebookLMCard {...baseProps} />);
    expect(screen.getByRole('button', { name: /Generate NotebookLM bundle/i })).toBeInTheDocument();
  });

  it('calls onGenerateNotebookLM when clicked', () => {
    const onGenerateNotebookLM = vi.fn();
    render(<NotebookLMCard {...baseProps} onGenerateNotebookLM={onGenerateNotebookLM} />);
    fireEvent.click(screen.getByRole('button', { name: /Generate NotebookLM bundle/i }));
    expect(onGenerateNotebookLM).toHaveBeenCalledTimes(1);
  });

  it('renders nothing when currentBriefing is null', () => {
    const { container } = render(<NotebookLMCard {...baseProps} currentBriefing={null} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders no hallucination-related UI', () => {
    render(<NotebookLMCard {...baseProps} notebookLMStatus="Hallucination: no" />);
    expect(screen.queryByLabelText(/hallucination check/i)).toBeNull();
    expect(screen.queryByRole('checkbox', { name: /hallucination/i })).toBeNull();
  });

  it('disables the button while generating', () => {
    render(<NotebookLMCard {...baseProps} notebookLMGenerating />);
    expect(screen.getByRole('button')).toBeDisabled();
    expect(screen.getByText(/Building bundle/i)).toBeInTheDocument();
  });
});
