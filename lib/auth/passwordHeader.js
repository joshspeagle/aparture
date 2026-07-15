// Codec for the `x-aparture-password` request header.
//
// fetch() enforces the ByteString constraint on header values: any character
// above U+00FF throws a TypeError before the request is even sent. A password
// like 'pä密🔑' therefore SAVES fine (POST bodies are JSON) but every
// header-authenticated GET/DELETE throws client-side — briefings and sessions
// written to disk become unloadable. Percent-encoding the value keeps the
// header ASCII-safe for any password; the server decodes before comparing.
//
// Kept separate from checkAccessPassword.js so client hooks can import the
// encoder without pulling node:crypto into the browser bundle.

/** Encode a password for transport in the x-aparture-password header. */
export function encodePasswordHeader(password) {
  return encodeURIComponent(password ?? '');
}

/**
 * Decode an x-aparture-password header value on the server.
 *
 * Malformed percent-encoding (e.g. a hand-crafted `%E0%A4%A` sequence) must
 * read as a WRONG password — never throw out of the route handler. Returns
 * null in that case; checkAccessPassword(null) is false → 401.
 * Non-string input (absent header) passes through unchanged so the existing
 * "missing header → 401" behavior is preserved.
 */
export function decodePasswordHeader(headerValue) {
  if (typeof headerValue !== 'string') return headerValue;
  try {
    return decodeURIComponent(headerValue);
  } catch {
    return null;
  }
}
