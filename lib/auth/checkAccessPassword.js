import { createHash, timingSafeEqual } from 'crypto';

// Validates a request password against ACCESS_PASSWORD.
//
// Fails closed: when ACCESS_PASSWORD is unset or empty, NO password is
// accepted. Without this guard, a route comparing `password !==
// process.env.ACCESS_PASSWORD` on a misconfigured deployment authorizes
// credential-less requests (`undefined !== undefined` is false).
//
// Timing-safe: a plain `===` short-circuits at the first differing
// character, leaking prefix-match length to an attacker who can measure
// response times. Both sides are length-normalized through SHA-256 before
// crypto.timingSafeEqual — the digest step also avoids the length-mismatch
// throw (and the length oracle an early-exit length check would reintroduce).
export function checkAccessPassword(password) {
  const configured = process.env.ACCESS_PASSWORD;
  if (!configured || typeof password !== 'string') return false;
  const provided = createHash('sha256').update(password, 'utf8').digest();
  const expected = createHash('sha256').update(configured, 'utf8').digest();
  return timingSafeEqual(provided, expected);
}
