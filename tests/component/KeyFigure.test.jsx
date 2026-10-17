import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import KeyFigure from '../../components/briefing/KeyFigure.jsx';
import { useAnalyzerStore, initialState } from '../../stores/analyzerStore.js';

const figure = { label: 'Figure 3', caption: 'Figure 3. Posterior widths.', page: 5 };

beforeEach(() => {
  useAnalyzerStore.setState({ ...initialState(), password: 'pw' });
  URL.createObjectURL = vi.fn(() => 'blob:figure');
  URL.revokeObjectURL = vi.fn();
});
afterEach(() => vi.restoreAllMocks());

describe('KeyFigure', () => {
  it('loads the image with the password header and shows the paper’s caption', async () => {
    const fetchSpy = vi
      .spyOn(global, 'fetch')
      .mockResolvedValue({ ok: true, blob: async () => new Blob(['png']) });
    render(<KeyFigure arxivId="hep-th/9901001" figure={figure} />);
    const img = await screen.findByRole('img', { name: 'Figure 3. Posterior widths.' });
    expect(img).toHaveAttribute('src', 'blob:figure');
    expect(screen.getByText(/From the paper, page 5/)).toBeInTheDocument();
    expect(fetchSpy).toHaveBeenCalledWith('/api/figures/hep-th%2F9901001', {
      headers: { 'x-aparture-password': 'pw' },
    });
  });

  it('shows nothing when the image is missing', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue({ ok: false, status: 404 });
    const { container } = render(<KeyFigure arxivId="2610.00001" figure={figure} />);
    await waitFor(() => expect(fetchSpy).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });

  it('asks for nothing when the paper has no key figure', () => {
    const fetchSpy = vi.spyOn(global, 'fetch');
    const { container } = render(<KeyFigure arxivId="2610.00001" figure={null} />);
    expect(container).toBeEmptyDOMElement();
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
