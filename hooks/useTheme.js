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

function resolveTheme(theme) {
  if (theme === 'auto') return getSystemPreference();
  return theme;
}

export function useTheme() {
  const [theme, setThemeState] = useState(getStoredTheme);

  const resolvedTheme = resolveTheme(theme);

  const setTheme = useCallback((newTheme) => {
    setThemeState(newTheme);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(THEME_KEY, newTheme);
    }
  }, []);

  // Apply data-theme attribute to <html>
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const resolved = resolveTheme(theme);
    if (theme === 'auto') {
      // In auto mode, remove data-theme so the CSS media query takes over
      document.documentElement.removeAttribute('data-theme');
    } else {
      document.documentElement.dataset.theme = resolved;
    }
  }, [theme]);

  // Listen for system preference changes in auto mode
  useEffect(() => {
    if (
      typeof window === 'undefined' ||
      typeof window.matchMedia !== 'function' ||
      theme !== 'auto'
    )
      return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => setThemeState((prev) => prev); // Force re-render to update resolvedTheme
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [theme]);

  return { theme, resolvedTheme, setTheme };
}
