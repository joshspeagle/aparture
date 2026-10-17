# Publishing the briefing page

The rendered `briefing.html` is a complete page: figures inlined, links out to arXiv and alphaXiv, and feedback controls that write to the page's own database. Published as a private claude.ai artifact it gives the reader one bookmark that works on a phone, and it gives the next run a channel for the reader's stars, comments, answers and decisions.

## First publish

Call the Artifact tool:

- `file_path`: `$RUN/briefing.html`
- `icon`: `newspaper`
- `description`: one sentence, e.g. "The reader's daily arXiv briefing from Aparture."
- `capabilities`: `{ "db": {}, "sample": {} }` — `db` stores feedback in a `feedback` collection; `sample` powers the per-paper "Ask about it" box. The page works without either (it becomes read-only).

Then write the returned URL into `config.json` as `briefingArtifactUrl`, and do one functional check: an ArtifactData `list` of the `feedback` collection on that URL (an empty result is the expected answer on day one). Report the link.

## Every later run

Publish to the same URL so the reader keeps one bookmark. A scheduled run is a new session, so first read the existing artifact (`action: "read"`, `url: briefingArtifactUrl`), then publish with `url: briefingArtifactUrl` and the new `file_path`. Omit `capabilities` and `icon` so the stored ones carry forward. The feedback collection survives republishing; old documents stay readable by date, and `ingest` only appends what changed.

## What the page holds, and who can see it

The page embeds the reader's profile (the first ~1,500 characters, used by the "Ask" box) and each paper's deep-read report. It is private to the reader by default. If the reader shares it, say plainly that the profile excerpt travels with it, and that viewers without edit access can read but not leave feedback.

## Without the Artifact tool

Leave `$RUN/briefing.html` in place (render with `--standalone` for a page that opens directly in a browser) and give the reader its path. Feedback then comes through chat: the reader says what they starred or disliked, and phase 1 records it with `source: "chat"`.
