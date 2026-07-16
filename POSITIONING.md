# Positioning

_Last revised 2026-07-15. This is the business case for Aparture: what problem it solves, for whom, against what alternatives, and what would count as success or failure. When a design question can't be settled by the [design principles](docs/concepts/design-principles.md), it should be settled here._

## The statement

Aparture exists so a researcher can stop skimming the arXiv without worrying about what they're missing. You describe your research in plain English. Each run filters the day's papers against that description, reads the strongest matches in full, and writes one briefing that connects them. Every citation is checked against the papers it was actually given before the briefing renders. When it misjudges a paper, you say so, and it proposes an edit to your profile that you accept or reject. It runs on your machine, with your API keys.

## 1. Problem

arXiv logged 32,040 new papers in June 2026, its third monthly record this year. A researcher watching several categories faces 100–300 new listings a day. The daily skim takes 30–60 minutes, most of it spent discarding, and skipping a day risks missing the one paper that matters. Tools exist to shorten the list, but a shorter list is still a list: you still do the reading, and you still do the judging. The skim survives because nothing is trusted enough to replace it.

## 2. User

**Lead:** a PhD student or postdoc in a specific, fast-moving subfield, who needs high recall on a narrow agenda and reads the listings out of scoop anxiety. Onboarding, starter templates, and the tutorial are written for this person.

**Secondary:** a senior researcher spanning several archives (cs, stat, astro-ph), who needs breadth with judgment and has the least time of anyone. The architecture was built for this person and the docs cover the breadth workflow as the power-user path.

**Explicit non-user, for now:** labs wanting a shared digest. One researcher per instance.

Both users currently rely on some mix of arXiv listing emails, Scholar Inbox, social media, and group chat.

## 3. Alternatives, and where each stops short

- **Free ranked feeds** (Scholar Inbox, Semantic Scholar research feeds, alphaXiv): rank the day's papers well, free, at real scale. They shorten the list but don't read it for you, and they learn your taste through embeddings you can't inspect or correct directly.
- **Query tools** (Elicit, Undermind, Consensus): genuinely synthesize across papers, but per question, priced $10–45/month. Monitoring is a gated side feature. They answer what you ask; they don't watch your field.
- **DIY digest scripts** (zotero-arxiv-daily at ~5.7k stars, ChatPaper, ArxivDigest): free, self-hosted, bring-your-own-key, per-paper summaries. No cross-paper synthesis, no validation, no feedback loop. This is the lane Aparture physically lives in, and it is crowded.
- **Platform assistants** (ChatGPT Pulse, Gemini scheduled actions): proactive morning briefings, but generic — opaque sourcing, no citation checks, no reproducibility, shallow arXiv handling.

## 4. What is actually different

Market research (2026-07) confirms three claims and kills one.

**Confirmed differentiated:**

1. **One editorial briefing per run over a personalized paper set.** No surveyed tool does this. Ranked feeds produce lists; query tools synthesize per question; Paper Digest's daily review is impact-ranked aggregation, not profile-driven synthesis.
2. **Validation before display.** Every cited arXiv ID is checked against the input set; per-paper claims are audited before the briefing renders. No digest tool advertises anything like it, and hallucinated citations are the field's live complaint (15–20% fabrication rates on citation tasks are reported even for frontier models).
3. **Legible personalization that grows.** The profile is a document the user wrote; feedback becomes a proposed edit the user approves. The profile works like memory: it accumulates what the tool learns, in a form the user can read, edit, and carry forward. Incumbents learn silently via embeddings; no surveyed tool offers auditable preference evolution.

**Not differentiated (table stakes):** personalized daily ranking (Scholar Inbox et al., free), plain-English criteria driving LLM scoring (open-source projects did it in 2023; Elicit and Undermind use natural-language questions), LLM deep-reading of PDFs (universal), per-paper summaries (commodity), self-hosted BYOK digests (the most crowded free niche of all).

**Reframed:** the mid-pipeline review gates are control over what gets deep-read, not cost management. Against free competitors, "approve each spend" reads as friction; "you decide which papers deserve a full read" is the honest and better framing.

## 5. Why now

Three things changed together: models became good and cheap enough to deep-read a dozen PDFs daily for pocket change; structured outputs made citation validation mechanical rather than aspirational; and submission volume broke the manual skim for good.

## 6. Success criteria

- The user stops the manual skim within two weeks and does not restart it.
- A typical daily run costs cents to low single dollars.
- No fabricated citation ever reaches a rendered briefing.
- Profile edit suggestions are accepted more often than rejected.

## 7. Non-goals

Hosted multi-user. Reference management. A search/memory product over past briefings (briefings are a morning paper, not an archive to mine; the existing simple history search is enough). General literature Q&A. The podcast stays an add-on.

## 8. Risks

- **Willingness to pay for monitoring is unproven anywhere in the market** — researchers pay for search and review automation, not daily triage. Aparture's answer is that it isn't sold: it's free, self-hosted, BYOK. But the setup cost still competes with a zero-effort Scholar Inbox signup, so the first run has to justify the install.
- **One hallucinated briefing ends the habit permanently.** Validation is the product, not a feature of it.
- **Daily PDF deep-reads can cost more per month than a subscription tool.** Frugal defaults, cross-run dedupe, and the gates are what keep the economics honest.
- **Nothing here is proprietary.** Free incumbents could bolt on synthesis; platforms already ship generic briefings. The defensible ground is what both are structurally bad at: checked citations, inspectable personalization, a reproducible pipeline.
- **Model churn breaks daily tools.** Registry refreshes are maintenance, not polish (this repo's own audit found a retired model ID serving 404s).

## 9. Voice

Rules for all user-facing prose — README, docs, UI copy, and this file:

- Short declarative sentences. Concrete nouns.
- Name the mechanism, not the virtue: "citations are checked against the input list," never "trustworthy."
- At most one metaphor, and only if it does real work.
- No slogan fragments, no rule-of-three rhythm, no em-dash chains.
- The register of the troubleshooting page, not of a landing page.

## Appendix: market landscape (2026-07 snapshot)

| Tool                                                                   | What it is                                                                                                         | Personalization                               | Output shape                                   | Pricing                                       |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | --------------------------------------------- | ---------------------------------------------- | --------------------------------------------- |
| Scholar Inbox                                                          | Daily personalized recommender (arXiv + bio/med/chem-rxiv); strongest free incumbent, "tens of thousands" of users | Trained from paper up/down votes (embeddings) | Ranked list + per-paper visual summaries       | Free                                          |
| Semantic Scholar feeds                                                 | Adaptive recommender tied to library folders                                                                       | Save/not-relevant signals (embeddings)        | Ranked list + TLDRs                            | Free                                          |
| alphaXiv                                                               | arXiv overlay: comments, grounded per-paper AI, trending feeds ($7M seed, 2025)                                    | Followed topics                               | Per-paper                                      | Free                                          |
| Google Scholar alerts                                                  | Keyword/author email alerts                                                                                        | Manual keywords                               | Raw list                                       | Free                                          |
| Emergent Mind                                                          | arXiv explorer, topic pages, trending digest                                                                       | Followed topics                               | Per-topic/per-paper                            | Free–$25/mo                                   |
| Undermind                                                              | Deep agentic literature search + topic-monitoring alerts                                                           | Saved natural-language questions              | Per-query synthesis; per-topic alerts          | ~$16–20/mo, enterprise                        |
| Elicit                                                                 | Review automation; alerts with natural-language screening rubric                                                   | Explicit question per alert                   | Per-query synthesis; screened alert lists      | $12–49/mo (alerts gated)                      |
| Paper Digest                                                           | Daily digests since 2018; impact-ranked daily review                                                               | Areas/keywords                                | Per-paper one-liners; shallow aggregate review | Paid, price unlisted                          |
| Consensus / SciSpace                                                   | Evidence-focused Q&A / chat-with-paper                                                                             | Query-based                                   | Per-query                                      | $10–90/mo                                     |
| OSS scripts (zotero-arxiv-daily 5.7k★, ChatPaper 19.7k★, ArxivDigest…) | Self-hosted BYOK daily digests                                                                                     | Zotero library or plain-English interests     | Per-paper scores/summaries                     | Free                                          |
| ChatGPT Pulse / Gemini scheduled actions                               | Generic proactive morning briefings                                                                                | Chat history / prompt                         | Cross-source briefing, unvalidated             | Platform plans                                |
| arxiv-sanity                                                           | Karpathy's recommender                                                                                             | Tags + SVM                                    | Ranked list                                    | Dead (2025) — its shutdown is a demand signal |

Primary sources include scholar-inbox.com, arxiv.org/stats/monthly_submissions, elicit.com/pricing, undermind.ai, github.com/TideDra/zotero-arxiv-daily, openai.com/index/introducing-chatgpt-pulse.
