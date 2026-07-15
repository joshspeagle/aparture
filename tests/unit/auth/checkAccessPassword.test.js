import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { checkAccessPassword } from '../../../lib/auth/checkAccessPassword.js';

const ORIGINAL = process.env.ACCESS_PASSWORD;

describe('checkAccessPassword', () => {
  beforeEach(() => {
    delete process.env.ACCESS_PASSWORD;
  });

  afterEach(() => {
    if (ORIGINAL === undefined) delete process.env.ACCESS_PASSWORD;
    else process.env.ACCESS_PASSWORD = ORIGINAL;
  });

  it('accepts the exact configured password', () => {
    process.env.ACCESS_PASSWORD = 'hunter2';
    expect(checkAccessPassword('hunter2')).toBe(true);
  });

  it('rejects a mismatched password', () => {
    process.env.ACCESS_PASSWORD = 'hunter2';
    expect(checkAccessPassword('hunter3')).toBe(false);
  });

  it('rejects a password of different length (no length-mismatch throw)', () => {
    process.env.ACCESS_PASSWORD = 'hunter2';
    expect(() => checkAccessPassword('h')).not.toThrow();
    expect(checkAccessPassword('h')).toBe(false);
    expect(checkAccessPassword('hunter2-and-more')).toBe(false);
  });

  it('fails closed when ACCESS_PASSWORD is unset — even for undefined input', () => {
    expect(checkAccessPassword(undefined)).toBe(false);
    expect(checkAccessPassword('anything')).toBe(false);
  });

  it('fails closed when ACCESS_PASSWORD is the empty string', () => {
    process.env.ACCESS_PASSWORD = '';
    expect(checkAccessPassword('')).toBe(false);
    expect(checkAccessPassword('anything')).toBe(false);
  });

  it('rejects empty-string input against a configured password', () => {
    process.env.ACCESS_PASSWORD = 'hunter2';
    expect(checkAccessPassword('')).toBe(false);
  });

  it('rejects non-string inputs without throwing', () => {
    process.env.ACCESS_PASSWORD = 'hunter2';
    expect(checkAccessPassword(null)).toBe(false);
    expect(checkAccessPassword(12345)).toBe(false);
    expect(checkAccessPassword({ toString: () => 'hunter2' })).toBe(false);
  });

  it('handles multi-byte (UTF-8) passwords', () => {
    process.env.ACCESS_PASSWORD = 'pässwörd✓';
    expect(checkAccessPassword('pässwörd✓')).toBe(true);
    expect(checkAccessPassword('passwörd✓')).toBe(false);
  });
});
