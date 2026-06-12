// hooks/useTheme.js
// Theme provider for light/dark/auto switching.
// Reads/writes 'aparture-theme' in localStorage.
// Applies data-theme attribute to <html> for CSS token switching.

import { useState, useEffect, useCallback } from 'react';

const THEME_KEY = 'aparture-theme';

function getStoredTheme() {
  if (typeof window === 'undefined') return 'auto';
  return window.localStorage.getItem(THEME_KEY) || 'auto';
}

function getSystemPreference() {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function useTheme() {
  const [theme, setThemeState] = useState(getStoredTheme);
  // The resolved system preference is REAL state (not derived on the fly):
  // an OS theme change in auto mode must re-render resolvedTheme consumers
  // (e.g. the Sidebar theme icon). The previous setThemeState((prev) => prev)
  // listener was a React bail-out no-op, so consumers never updated.
  const [systemPreference, setSystemPreference] = useState(getSystemPreference);

  const resolvedTheme = theme === 'auto' ? systemPreference : theme;

  const setTheme = useCallback((newTheme) => {
    setThemeState(newTheme);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(THEME_KEY, newTheme);
    }
  }, []);

  // Apply data-theme attribute to <html>
  useEffect(() => {
    if (typeof document === 'undefined') return;
    if (theme === 'auto') {
      // In auto mode, remove data-theme so the CSS media query takes over
      document.documentElement.removeAttribute('data-theme');
    } else {
      document.documentElement.dataset.theme = theme;
    }
  }, [theme]);

  // Track system preference changes. Always listening (not just in auto mode)
  // keeps systemPreference fresh for the moment the user switches to auto.
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e) => setSystemPreference(e.matches ? 'dark' : 'light');
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  return { theme, resolvedTheme, setTheme };
}
