// components/shell/MobileTopBar.jsx
// Slim top bar shown only under 768px (shell.css hides it on desktop):
// hamburger button that opens the off-canvas sidebar drawer + brand
// wordmark. Rendered unconditionally — visibility is pure CSS, so the
// desktop layout stays pixel-identical and jsdom tests need no
// matchMedia mocks.

import { Menu } from 'lucide-react';

export default function MobileTopBar({ onMenuClick }) {
  return (
    <div className="shell-topbar">
      <button
        type="button"
        className="shell-menu-button"
        aria-label="Open menu"
        onClick={onMenuClick}
      >
        <Menu className="w-5 h-5" />
      </button>
      {/* Wordmark — same serif Ap[ar]ture treatment as the sidebar logo. */}
      <div
        style={{
          fontFamily: 'var(--aparture-font-serif)',
          fontSize: 'var(--aparture-text-lg)',
          fontWeight: 700,
          letterSpacing: '-0.01em',
          color: 'var(--aparture-ink)',
        }}
      >
        <span>Ap</span>
        <span
          style={{
            color: 'var(--aparture-accent)',
            fontWeight: 700,
            borderBottom: '2px solid var(--aparture-accent)',
            paddingBottom: '1px',
          }}
        >
          ar
        </span>
        <span>ture</span>
      </div>
    </div>
  );
}
