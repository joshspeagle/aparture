import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import FeedbackFilters from '../../../components/feedback/FeedbackFilters.jsx';

describe('FeedbackFilters', () => {
  const defaultFilters = { type: 'all', newOnly: false, dateRange: 'all' };

  it('renders four type toggle buttons', () => {
    render(<FeedbackFilters filters={defaultFilters} onFiltersChange={() => {}} />);
    expect(screen.getByRole('button', { name: /^all$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /star/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /dismiss/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /comment/i })).toBeInTheDocument();
  });

  it('marks the active type with data-active attribute', () => {
    const { container } = render(
      <FeedbackFilters filters={{ ...defaultFilters, type: 'stars' }} onFiltersChange={() => {}} />
    );
    // Active button should have data-active attribute
    const active = container.querySelector('button[data-active]');
    expect(active).not.toBeNull();
    expect(active.textContent).toMatch(/star/i);
  });

  it('calls onFiltersChange with the new type when a type button is clicked', () => {
    const onFiltersChange = vi.fn();
    render(<FeedbackFilters filters={defaultFilters} onFiltersChange={onFiltersChange} />);
    fireEvent.click(screen.getByRole('button', { name: /star/i }));
    expect(onFiltersChange).toHaveBeenCalledWith({ ...defaultFilters, type: 'stars' });
  });

  it('renders a new-only checkbox controlled by filters.newOnly', () => {
    const { rerender } = render(
      <FeedbackFilters filters={defaultFilters} onFiltersChange={() => {}} />
    );
    expect(screen.getByRole('checkbox')).not.toBeChecked();
    rerender(
      <FeedbackFilters filters={{ ...defaultFilters, newOnly: true }} onFiltersChange={() => {}} />
    );
    expect(screen.getByRole('checkbox')).toBeChecked();
  });

  it('calls onFiltersChange when the new-only checkbox toggles', () => {
    const onFiltersChange = vi.fn();
    render(<FeedbackFilters filters={defaultFilters} onFiltersChange={onFiltersChange} />);
    fireEvent.click(screen.getByRole('checkbox'));
    expect(onFiltersChange).toHaveBeenCalledWith({ ...defaultFilters, newOnly: true });
  });

  it('renders a date range dropdown with four options', () => {
    render(<FeedbackFilters filters={defaultFilters} onFiltersChange={() => {}} />);
    const select = screen.getByRole('combobox');
    expect(select).toBeInTheDocument();
    // Check the options are in the DOM
    expect(within(select).getByText(/all time/i)).toBeInTheDocument();
    expect(within(select).getByText(/past 7 days/i)).toBeInTheDocument();
    expect(within(select).getByText(/past 14 days/i)).toBeInTheDocument();
    expect(within(select).getByText(/past 30 days/i)).toBeInTheDocument();
  });

  it('calls onFiltersChange with the new dateRange when the dropdown changes', () => {
    const onFiltersChange = vi.fn();
    render(<FeedbackFilters filters={defaultFilters} onFiltersChange={onFiltersChange} />);
    fireEvent.change(screen.getByRole('combobox'), { target: { value: '14d' } });
    expect(onFiltersChange).toHaveBeenCalledWith({ ...defaultFilters, dateRange: '14d' });
  });
});
