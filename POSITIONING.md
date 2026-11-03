# Positioning

_Last revised 2026-07-15. This document defines the product case for Aparture: what problem it solves, for whom, against which alternatives, and what counts as success or failure. Design questions that are not settled by the [design principles](docs/concepts/design-principles.md) are settled here._

## The statement

Aparture exists so a researcher can stop skimming the arXiv without worrying about missing relevant papers. You describe your research in plain English. Each run filters the day's papers against that description, reads the strongest matches in full, and writes a single briefing that connects them. Every citation is verified against the input papers before the briefing renders. When the pipeline misjudges a paper, you record feedback, and Aparture proposes an edit to your profile that you can accept or reject. The application runs locally on your machine using your own API keys.

## 1. Problem

arXiv logged 32,040 new papers in June 2026, setting a monthly submission record. A researcher watching several categories faces 100–300 new listings a day. The daily skim takes 30–60 minutes, most of which is spent discarding irrelevant papers, and skipping a day risks missing a key result. Existing tools shorten the list, but a shorter list still requires the researcher to read and evaluate each candidate manually. The manual skim persists because existing tools do not verify their synthesis deeply enough to replace direct inspection.

## 2. User

- **Lead user:** A PhD student or postdoc in a fast-moving subfield who needs high recall on a focused research agenda and monitors daily listings to stay current. Onboarding, starter templates, and the tutorial target this workflow.
- **Secondary user:** A senior researcher spanning several archives (`cs`, `stat`, `astro-ph`) who needs cross-disciplinary breadth with calibrated selectivity and has limited time for manual triage. The architecture was built for this workflow, and the documentation covers multi-archive monitoring as the advanced path.
- **Out of scope for now:** Research groups seeking a shared multi-user digest. Each Aparture instance serves a single researcher.

Both user groups currently rely on a combination of arXiv email alerts, Scholar Inbox, social media, and group chat.

## 3. Alternatives, and where each stops short

- **Free ranked feeds** (Scholar Inbox, Semantic Scholar research feeds, alphaXiv): These services rank the day's papers effectively and free of charge at scale, but they return a list of individual papers and learn preferences through black-box embeddings that users cannot inspect or edit directly.
- **Query tools** (Elicit, Undermind, Consensus): These tools synthesize across papers in response to a specific question for \$10–45/month, treating ongoing monitoring as a secondary feature rather than watching a field continuously.
- **DIY digest scripts** (zotero-arxiv-daily at ~5.7k stars, ChatPaper, ArxivDigest): These free, self-hosted, bring-your-own-key scripts generate independent per-paper summaries without cross-paper synthesis, citation verification, or an iterative feedback loop.
- **Platform assistants** (ChatGPT Pulse, Gemini scheduled actions): These general-purpose assistants deliver proactive morning briefings, but their sourcing is opaque, citations are unverified, runs are non-reproducible, and arXiv integration is shallow.

## 4. What sets Aparture apart

A July 2026 market review identified the core differentiators that separate Aparture from existing tools, alongside features that are standard across the category.

**Confirmed differentiators:**

1. **One editorial briefing per run over a personalized paper set.** Existing ranked feeds output individual items, query tools synthesize per question, and Paper Digest's daily review aggregates by general impact score. Aparture writes a single thematic argument driven by the reader's written profile.
2. **Validation before display.** Every cited arXiv ID is checked against the input set, and per-paper factual claims are audited against the source text before the briefing renders. Hallucinated citations remain a central failure mode across LLM tooling (with 15–20% fabrication rates reported on citation tasks even for frontier models), so deterministic and model-backed verification is essential.
3. **Legible personalization that evolves.** The research profile is a plain-text document written by the user, and feedback turns into concrete proposed edits that the user reviews and approves. Because the profile accumulates learned preferences in human-readable prose, the user can read, edit, and carry that memory forward across models and sessions.

**Baseline capabilities (table stakes):** Personalized daily ranking (Scholar Inbox and peers), plain-English criteria driving LLM scoring (introduced in open-source scripts in 2023 and used by Elicit and Undermind), full-PDF LLM reading, per-paper summaries, and self-hosted bring-your-own-key digests.

**Role of review gates:** The mid-pipeline review gates give the user direct control over which papers receive a full PDF read. Framing the gates around selecting which papers deserve deep analysis aligns the workflow with research judgment.

## 5. Why now

Recent shifts in model capability, structured decoding, and submission volume make this workflow viable: frontier and mid-tier models can now read a dozen PDFs daily for a few cents to a few dollars, schema-constrained outputs make citation validation deterministic, and rising arXiv submission volume has made manual skimming unsustainable across multiple categories.

## 6. Success criteria

- The user stops skimming raw arXiv listings within two weeks and relies on the daily briefing.
- A typical daily run costs between a few cents and a few dollars.
- Zero fabricated citations reach a rendered briefing.
- Profile edit suggestions are accepted more often than they are rejected.

## 7. Non-goals

Aparture does not aim to provide hosted multi-user accounts, reference management, an archival search product over past briefings (the built-in history filter is sufficient for revisiting recent runs), or general-purpose literature Q&A. The podcast generator remains an optional add-on.

## 8. Risks

- **Uncertain willingness to pay for daily triage:** Researchers pay for literature search and systematic review automation, while daily monitoring is typically free. Aparture addresses this by running as a free, self-hosted, bring-your-own-key application, though the initial setup effort still competes with instant web signups such as Scholar Inbox.
- **Trust fragility:** A single fabricated briefing can end a user's reliance on the tool permanently, which is why citation and claim validation sits in the critical path before display.
- **Cumulative PDF token costs:** Daily full-PDF analysis can exceed the monthly price of a commercial subscription if left unbounded. Frugal default models, cross-run deduplication, and review gates keep daily token spend predictable.
- **Low proprietary moat:** Free incumbents can add synthesis layers, and platform assistants already ship scheduled briefings. Aparture's durable advantage lies in verified citations, inspectable plain-text personalization, and a reproducible local pipeline.
- **Model lifecycle churn:** Provider model deprecations break daily tools unless the model registry and automatic migration maps stay current (an internal audit caught a retired model ID returning 404 responses).

## 9. Voice

All user-facing prose across `README.md`, `docs/`, UI copy, and repository documentation follows the Synergistic Prose Register:

- Write complete declarative sentences with concrete domain nouns and exact technical terms.
- Name the mechanism and explain why it holds using an explicit `"because"` clause (`"citations are verified against the input list before rendering because fabricated IDs break reader trust"`).
- State what the system does positively, avoiding routine `"X, not Y"`, `"rather than"`, or `"instead of"` antithesis (use at most one contrast on a page where a genuine user misconception exists).
- Never use prose em-dashes, clipped verbless fragments, slogan taglines, announced counts, setup-and-reveal colons in running prose, or mannered metaphors.
- Maintain the clear, instructional register of a technical reference guide.

## Appendix: market landscape (2026-07 snapshot)

| Tool                                                                   | What it is                                                                                                         | Personalization                               | Output shape                                   | Pricing                                      |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | --------------------------------------------- | ---------------------------------------------- | -------------------------------------------- |
| Scholar Inbox                                                          | Daily personalized recommender (arXiv + bio/med/chem-rxiv); strongest free incumbent, "tens of thousands" of users | Trained from paper up/down votes (embeddings) | Ranked list + per-paper visual summaries       | Free                                         |
| Semantic Scholar feeds                                                 | Adaptive recommender tied to library folders                                                                       | Save/not-relevant signals (embeddings)        | Ranked list + TLDRs                            | Free                                         |
| alphaXiv                                                               | arXiv overlay: comments, grounded per-paper AI, trending feeds (\$7M seed, 2025)                                   | Followed topics                               | Per-paper                                      | Free                                         |
| Google Scholar alerts                                                  | Keyword/author email alerts                                                                                        | Manual keywords                               | Raw list                                       | Free                                         |
| Emergent Mind                                                          | arXiv explorer, topic pages, trending digest                                                                       | Followed topics                               | Per-topic/per-paper                            | Free–\$25/mo                                 |
| Undermind                                                              | Deep agentic literature search + topic-monitoring alerts                                                           | Saved natural-language questions              | Per-query synthesis; per-topic alerts          | ~\$16–20/mo, enterprise                      |
| Elicit                                                                 | Review automation; alerts with natural-language screening rubric                                                   | Explicit question per alert                   | Per-query synthesis; screened alert lists      | \$12–49/mo (alerts gated)                    |
| Paper Digest                                                           | Daily digests since 2018; impact-ranked daily review                                                               | Areas/keywords                                | Per-paper one-liners; shallow aggregate review | Paid, price unlisted                         |
| Consensus / SciSpace                                                   | Evidence-focused Q&A / chat-with-paper                                                                             | Query-based                                   | Per-query                                      | \$10–90/mo                                   |
| OSS scripts (zotero-arxiv-daily 5.7k★, ChatPaper 19.7k★, ArxivDigest…) | Self-hosted BYOK daily digests                                                                                     | Zotero library or plain-English interests     | Per-paper scores/summaries                     | Free                                         |
| ChatGPT Pulse / Gemini scheduled actions                               | Generic proactive morning briefings                                                                                | Chat history / prompt                         | Cross-source briefing, unvalidated             | Platform plans                               |
| arxiv-sanity                                                           | Karpathy's recommender                                                                                             | Tags + SVM                                    | Ranked list                                    | Shut down in 2025 (demonstrated user demand) |

Primary sources include scholar-inbox.com, arxiv.org/stats/monthly_submissions, elicit.com/pricing, undermind.ai, github.com/TideDra/zotero-arxiv-daily, and openai.com/index/introducing-chatgpt-pulse.
