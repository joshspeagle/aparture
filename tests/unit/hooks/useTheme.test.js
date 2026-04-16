import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTheme } from '../../../hooks/useTheme.js';

beforeEach(() => {
  window.localStorage.clear();
  document.documentElement.removeAttribute('data-theme');

  // jsdom doesn't ship matchMedia — provide a minimal stub that
  // reports "light" (prefers-color-scheme: dark → false).
  window.matchMedia = (query) => ({
    matches: false,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    onchange: null,
    dispatchEvent: () => false,
  });
});

describe('useTheme', () => {
  it('defaults to auto when no localStorage key exists', () => {
    const { result } = renderHook(() => useTheme());
    expect(result.current.theme).toBe('auto');
  });

  it('reads stored theme from localStorage', () => {
    window.localStorage.setItem('aparture-theme', 'dark');
    const { result } = renderHook(() => useTheme());
    expect(result.current.theme).toBe('dark');
    expect(result.current.resolvedTheme).toBe('dark');
  });

  it('setTheme persists to localStorage and updates state', () => {
    const { result } = renderHook(() => useTheme());
    act(() => {
      result.current.setTheme('dark');
    });
    expect(result.current.theme).toBe('dark');
    expect(result.current.resolvedTheme).toBe('dark');
    expect(window.localStorage.getItem('aparture-theme')).toBe('dark');
  });

  it('setTheme to light works correctly', () => {
    const { result } = renderHook(() => useTheme());
    act(() => {
      result.current.setTheme('light');
    });
    expect(result.current.theme).toBe('light');
    expect(result.current.resolvedTheme).toBe('light');
    expect(window.localStorage.getItem('aparture-theme')).toBe('light');
  });

  it('applies data-theme attribute for explicit themes', () => {
    const { result } = renderHook(() => useTheme());
    act(() => {
      result.current.setTheme('dark');
    });
    expect(document.documentElement.dataset.theme).toBe('dark');
  });

  it('removes data-theme attribute in auto mode', () => {
    document.documentElement.dataset.theme = 'dark';
    const { result } = renderHook(() => useTheme());
    act(() => {
      result.current.setTheme('auto');
    });
    expect(document.documentElement.dataset.theme).toBeUndefined();
  });

  it('resolvedTheme returns light or dark in auto mode based on system preference', () => {
    const { result } = renderHook(() => useTheme());
    // In jsdom, matchMedia always returns false for dark, so resolvedTheme should be 'light'
    expect(result.current.theme).toBe('auto');
    expect(result.current.resolvedTheme).toBe('light');
  });
});
