import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import SidebarBriefingList from '../../../components/shell/SidebarBriefingList.jsx';

const history = [
  { id: 'b1', date: '2026-10-12', timestamp: 1, archived: false, papers: [] },
  { id: 'b2', date: '2026-10-13', timestamp: 2, archived: false, papers: [] },
];

function renderList(overrides = {}) {
  const props = {
    briefingHistory: history,
    feedbackEvents: [],
    activeView: 'briefing:b2',
    onSelectView: vi.fn(),
    onDeleteBriefing: vi.fn(),
    onToggleArchive: vi.fn(),
    ...overrides,
  };
  render(<SidebarBriefingList {...props} />);
  return props;
}

describe('SidebarBriefingList keyboard and names', () => {
  it('opens a briefing from its label button and marks the active one', () => {
    const props = renderList();
    const label = screen.getByRole('button', { name: /^\w+ · Oct 12$/ });
    fireEvent.click(label);
    expect(props.onSelectView).toHaveBeenCalledWith('briefing:b1');
    expect(screen.getByRole('button', { name: /^\w+ · Oct 13$/ })).toHaveAttribute(
      'aria-current',
      'page'
    );
  });

  it('names the icon buttons after the action and the briefing', () => {
    renderList();
    expect(screen.getByRole('button', { name: /^Archive .*Oct 12/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Delete .*Oct 12/ })).toBeInTheDocument();
  });

  // Regression: the row used to be a role=button div whose Enter handler
  // also caught Enter on the nested Archive button, so it navigated instead.
  it('Enter on Archive archives without opening the briefing', () => {
    const props = renderList();
    const archive = screen.getByRole('button', { name: /^Archive .*Oct 12/ });
    fireEvent.keyDown(archive, { key: 'Enter' });
    // A native button turns Enter into a click; jsdom needs it spelled out.
    fireEvent.click(archive);
    expect(props.onToggleArchive).toHaveBeenCalledWith('b1');
    expect(props.onSelectView).not.toHaveBeenCalled();
  });
});
