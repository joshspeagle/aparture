import { describe, it, expect, vi } from 'vitest';
import { useState } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import MobileTopBar from '../../../components/shell/MobileTopBar.jsx';
import Sidebar from '../../../components/shell/Sidebar.jsx';

// jsdom has no layout, so these tests assert the drawer's state contract
// (the shell-sidebar--open modifier class + callbacks), not its visual
// off-canvas behavior — that lives in styles/shell.css media queries.

const sidebarProps = {
  briefingHistory: [],
  feedbackEvents: [],
  activeView: 'welcome',
  onSelectView: () => {},
  onNewBriefing: () => {},
  feedbackCount: 0,
  onDeleteBriefing: () => {},
  onToggleArchive: () => {},
};

describe('MobileTopBar', () => {
  it('renders the hamburger button and wordmark', () => {
    render(<MobileTopBar onMenuClick={() => {}} />);
    expect(screen.getByRole('button', { name: 'Open menu' })).toBeInTheDocument();
    expect(screen.getByText('ture')).toBeInTheDocument();
  });

  it('fires onMenuClick when the hamburger is clicked', () => {
    const onMenuClick = vi.fn();
    render(<MobileTopBar onMenuClick={onMenuClick} />);
    fireEvent.click(screen.getByRole('button', { name: 'Open menu' }));
    expect(onMenuClick).toHaveBeenCalledTimes(1);
  });
});

describe('Sidebar mobileOpen modifier', () => {
  it('has no --open modifier by default', () => {
    const { container } = render(<Sidebar {...sidebarProps} />);
    const el = container.querySelector('.shell-sidebar');
    expect(el).toBeTruthy();
    expect(el.classList.contains('shell-sidebar--open')).toBe(false);
  });

  it('adds the --open modifier when mobileOpen is true', () => {
    const { container } = render(<Sidebar {...sidebarProps} mobileOpen={true} />);
    const el = container.querySelector('.shell-sidebar.shell-sidebar--open');
    expect(el).toBeTruthy();
  });
});

// Minimal harness mirroring App.jsx's drawer wiring: hamburger opens,
// nav selection closes, scrim tap closes.
function DrawerHarness({ onSelectView }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="shell">
      <MobileTopBar onMenuClick={() => setOpen(true)} />
      <Sidebar
        {...sidebarProps}
        mobileOpen={open}
        onSelectView={(view) => {
          onSelectView?.(view);
          setOpen(false);
        }}
      />
      {open && <div className="shell-scrim" data-testid="scrim" onClick={() => setOpen(false)} />}
    </div>
  );
}

describe('drawer toggle state (App wiring contract)', () => {
  it('opens on hamburger click, closes on nav selection', () => {
    const onSelectView = vi.fn();
    const { container } = render(<DrawerHarness onSelectView={onSelectView} />);

    expect(container.querySelector('.shell-sidebar--open')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Open menu' }));
    expect(container.querySelector('.shell-sidebar--open')).toBeTruthy();

    fireEvent.click(screen.getByText('Settings'));
    expect(onSelectView).toHaveBeenCalledWith('settings');
    expect(container.querySelector('.shell-sidebar--open')).toBeNull();
  });

  it('closes when the scrim is tapped', () => {
    const { container } = render(<DrawerHarness />);
    fireEvent.click(screen.getByRole('button', { name: 'Open menu' }));
    expect(container.querySelector('.shell-sidebar--open')).toBeTruthy();

    fireEvent.click(screen.getByTestId('scrim'));
    expect(container.querySelector('.shell-sidebar--open')).toBeNull();
    expect(screen.queryByTestId('scrim')).toBeNull();
  });
});
