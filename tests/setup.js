import '@testing-library/jest-dom/vitest';

// Keep the suite hermetic. A developer's shell (or a sourced .env.local) can
// export real provider keys, a contact email, or a reports directory; left in
// place, the keys flow through route auth into callModel's input and change
// fixture hashes, and the others change request headers and write paths.
// Tests that need any of these set them explicitly.
for (const name of [
  'CLAUDE_API_KEY',
  'GOOGLE_AI_API_KEY',
  'OPENAI_API_KEY',
  'ARXIV_CONTACT_EMAIL',
  'APARTURE_REPORTS_DIR',
]) {
  delete process.env[name];
}
