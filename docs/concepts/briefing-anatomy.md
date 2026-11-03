# Briefing anatomy

Every rendered briefing combines the structured output of the Stage 5 synthesis model with cached artifacts from earlier pipeline stages, deterministic metadata validation, and post-synthesis audit results.

::: info Architectural reference
Prompt templates, schema validators, and pipeline stages work together to construct each component of a briefing. For a reader-focused guide on triaging daily papers, expanding summaries, and recording feedback, see [Reading a briefing](/using/reading-a-briefing).
:::

## Synthesis output structure {#three-sections-nothing-more}

Although a rendered briefing displays rich interactive panels, the `/api/synthesize` LLM call returns a compact JSON object with only three top-level fields: `executiveSummary`, `themes`, and `papers`. All surrounding elements on the page (the inline quick-summary expansions, the cropped key figures, the slide-over Stage 4 full reports, the **Notes from the editor** questions, the hallucination audit badge, the **Generation details** disclosure, and the interactive feedback footer) are populated from separate pipeline calls and deterministic state, keeping the synthesis model focused strictly on editorial writing:

<div style="margin: 1.5rem 0; padding: 1.25rem; border: 1px solid var(--vp-c-divider); border-radius: 12px; background: var(--vp-c-bg-soft);">
  <svg viewBox="0 0 720 490" style="width: 100%; height: auto; max-width: 720px; display: block; margin: 0 auto;" role="img" aria-label="Structural schematic of a rendered Aparture briefing showing Header, Audit Badge, Executive Summary, Thematic Sections with Full-Read Paper Cards and Key Figures, Papers Also Worth a Look, Notes from the Editor, and Interactive Feedback Footer">
    <rect x="28" y="14" width="664" height="86" rx="8" fill="var(--vp-c-brand-soft)" stroke="var(--vp-c-brand-1)" stroke-width="1.6" />
    <text x="48" y="38" font-family="var(--vp-font-family-mono)" font-size="13" font-weight="700" fill="var(--vp-c-brand-1)">1. Header + Audit Badge + Executive Summary</text>
    <text x="48" y="58" font-family="var(--vp-font-family-base)" font-size="12" fill="var(--vp-c-text-1)">Dateline, focus/screened counts, reading time, and claims-check audit badge</text>
    <text x="48" y="78" font-family="var(--vp-font-family-base)" font-size="12" fill="var(--vp-c-text-2)">200 to 400 word serif editorial lead ending with the primary reading recommendation</text>
    <rect x="28" y="110" width="664" height="156" rx="8" fill="var(--vp-c-bg)" stroke="var(--vp-c-divider)" stroke-width="1.4" />
    <text x="48" y="134" font-family="var(--vp-font-family-mono)" font-size="13" font-weight="700" fill="var(--vp-c-text-1)">2. Thematic Sections + Full-Read Paper Cards + Key Figures</text>
    <text x="48" y="153" font-family="var(--vp-font-family-base)" font-size="12" font-style="italic" fill="var(--vp-c-text-2)">Priority-ordered themes (2 to 5): 6 to 12 word argument headline + 2 to 4 sentence synthesis</text>
    <rect x="48" y="166" width="624" height="86" rx="6" fill="var(--vp-c-bg-soft)" stroke="var(--vp-c-divider)" stroke-width="1.2" />
    <text x="66" y="188" font-family="var(--vp-font-family-mono)" font-size="11" font-weight="700" fill="var(--vp-c-brand-1)">[Score 8.6] Paper Card (arxivId + verified title + abstract/PDF/HTML/alphaXiv links)</text>
    <text x="66" y="207" font-family="var(--vp-font-family-base)" font-size="11.5" fill="var(--vp-c-text-1)">15 to 25 word onelinePitch + 2 to 4 sentence whyMatters + cropped Stage 4 Key Figure &amp; caption</text>
    <text x="66" y="226" font-family="var(--vp-font-family-mono)" font-size="10.5" fill="var(--vp-c-text-2)">Cached expansions: [quick summary (~300w)] [full report (Stage 4)] + [star] [dismiss] [comment]</text>
    <text x="66" y="243" font-family="var(--vp-font-family-base)" font-size="11" fill="var(--vp-c-text-3)">Cross-listed theme references render as "Also in this theme (shown above)"</text>
    <rect x="28" y="276" width="664" height="52" rx="8" fill="var(--vp-c-bg)" stroke="var(--vp-c-divider)" stroke-width="1.4" />
    <text x="48" y="300" font-family="var(--vp-font-family-mono)" font-size="13" font-weight="700" fill="var(--vp-c-text-1)">3. Papers Also Worth a Look / Other Papers Fallback</text>
    <text x="48" y="318" font-family="var(--vp-font-family-base)" font-size="12" fill="var(--vp-c-text-2)">Secondary thematic clusters and deterministic fallback group ensuring zero omitted papers</text>
    <rect x="28" y="338" width="664" height="56" rx="8" fill="var(--vp-c-bg)" stroke="var(--vp-c-divider)" stroke-width="1.4" />
    <text x="48" y="362" font-family="var(--vp-font-family-mono)" font-size="13" font-weight="700" fill="var(--vp-c-text-1)">4. Notes from the Editor (/api/editor-questions)</text>
    <text x="48" y="381" font-family="var(--vp-font-family-base)" font-size="12" fill="var(--vp-c-text-2)">Up to two single-tap multiple-choice questions resolving profile ambiguities exposed by the run</text>
    <rect x="28" y="404" width="664" height="72" rx="8" fill="var(--vp-c-bg)" stroke="var(--vp-c-brand-1)" stroke-width="1.4" />
    <text x="48" y="428" font-family="var(--vp-font-family-mono)" font-size="13" font-weight="700" fill="var(--vp-c-text-1)">5. Interactive Feedback Footer, Audit Provenance &amp; Podcast Add-On</text>
    <text x="48" y="447" font-family="var(--vp-font-family-base)" font-size="11.5" fill="var(--vp-c-text-2)">Audit flagged claims, Generation details provenance, Feedback timeline, and Suggest improvements</text>
    <text x="48" y="464" font-family="var(--vp-font-family-mono)" font-size="11" fill="var(--vp-c-text-3)">Persisted to reports/briefings/&lt;id&gt;.json and indexed in browser localStorage</text>
  </svg>
</div>

## Section 1: the executive summary

The executive summary serves as the editorial lead at the top of the briefing, spanning two to four paragraphs (typically 200 to 400 words). The synthesis prompt (`prompts/synthesis.md`) specifies a three-part narrative structure so that the opening prose synthesizes the day's developments before concluding with an explicit reading recommendation:

> The editorial lead for the day. This is the first thing the user reads, so it should frame the day's papers as a story rather than a list.
>
> **First paragraph:** the headline. What is the single most important thing the user should know from today's papers: what changed, or where the papers disagree? If the user starred papers, those should anchor the framing. Do not list papers by name here; that is the rest of the briefing's job.
>
> **Subsequent paragraphs:** step back and set up the thematic structure. What clusters emerged? What is the throughline that connects otherwise separate papers? If the day is scattered across unrelated topics, say so honestly. Not every day has a unified narrative.
>
> **Final paragraph:** a clear reading recommendation. "If you read one paper today, make it [arxivId] because…" This is the most actionable sentence in the briefing.

The briefing view renders the executive summary immediately beneath the header bar, with one paragraph per paragraph returned by the model.

## Section 2: themes

Themes form the organizing structure of the briefing across two to five priority-ordered clusters, each containing an argument-style headline, a paragraph of editorial reasoning, and a list of paper references (`paperIds`). Every paper in the final round must appear in at least one theme. From `prompts/synthesis.md`:

> Themes are the organizing spine of the briefing. Each theme groups papers that share an argument, method, problem, or tension, and explains why the grouping matters.
>
> Themes should be **priority-ordered**: the most important theme (containing the highest-scored and starred papers) comes first.
>
> Each theme has:
>
> - `title`: a short headline (6–12 words) that reads as an argument or observation, not a label. Good: "Interpretability converges on attention heads." Bad: "Interpretability papers."
> - `argument`: a 2–4 sentence paragraph explaining why these papers belong together and what the user should take away. This is editorial writing, not a section header. If papers within the theme are in tension or build on each other, say so here. **Debates belong inside themes, not in a separate section.**
> - `paperIds`: the arxivIds of the papers in this theme.

Placing methodological debates and competing claims directly inside `theme.argument` keeps cross-paper comparisons grounded in the specific papers that follow below the heading.

In the briefing view, each theme renders as a numbered section in the priority order returned by the synthesis model. Each paper's full card renders once, inside the first theme that lists its `arxivId`; if a subsequent theme also lists that paper, the later theme displays an _"Also in this theme (shown above)"_ reference line. Any paper omitted from all themes by the model is placed in a trailing **Other papers** group so that every final-round paper remains accessible.

## Section 3: papers

The `papers` array contains one card object for each paper in the final round, pairing the paper's `arxivId`, `title`, and `score` with a one-line pitch (`onelinePitch`) and a profile-grounded paragraph explaining why it matters (`whyMatters`). While the synthesis LLM generates the prose fields, the interactive controls on each card (star, dismiss, comment, quick summary, and full report) bind to live React state, allowing cards in the briefing view and the Pipeline view's Analysis Results list to share the same component structure. From `prompts/synthesis.md`:

> Each paper card has:
>
> - `arxivId`: the paper's arXiv identifier
> - `title`: the paper's title, copied from the input
> - `score`: the paper's relevance score, copied from the input
> - `onelinePitch`: a 15–25 word pitch that captures the paper's argument or contribution. Not a summary, a pitch: what would this paper say if it were selling itself in one sentence?
> - `whyMatters`: a 2–4 sentence paragraph grounded in the user's profile and engagement signals.
>   - For **starred** papers: give the richest treatment. Reference the user's stated interests by name. Explain what makes this paper worth the user's time.
>   - For **high-score papers without engagement**: recommend clearly, grounded in profile alignment.
>   - For **medium-score papers**: be honest about the relevance. "This is adjacent to your work on X, but the core contribution is in Y."
>   - For **dismissed** papers: keep brief. Acknowledge the dismissal, and say why the paper is still worth a glance only if there is a genuine reason despite the user's signal.
>   - When **comments** exist: integrate them. The user's own words should shape your framing.

Before rendering, Aparture overwrites `title` and `score` on every card with the ground-truth values from the pipeline input so that model transcription errors can never alter a paper's title or score.

Each rendered card displays its color-coded relevance score badge (highlighted more brightly at 9.0+), the title linked to the arXiv abstract page, the direct resource links (**abstract · PDF · HTML · alphaXiv**), the italicized `onelinePitch`, the `whyMatters` paragraph, the cropped Stage 4 key figure and caption when available, and the action bar for quick summary, full report, star, dismiss, and comment.

## Everything else on the page

Quick summaries, cropped key figures, full Stage 4 reports, editor clarification questions, and generation provenance render alongside the synthesis prose from separate pipeline stages.

### Quick summaries

During Stage 5, `/api/analyze-pdf-quick` generates a roughly 300-word summary for each final-round paper in parallel using `quickSummaryModel`. Clicking <span class="ui-action">→ quick summary</span> on a paper card expands this text in a bordered block beneath the card. Quick summaries serve strictly as a reader convenience: they are not passed into `/api/synthesize` and are not evaluated by `/api/check-briefing`.

### Key figures

During Stage 4, the PDF analysis model identifies a single representative figure label (such as `"Figure 2"`), and the server locates the matching caption in the PDF text layer, crops the figure region above it, and saves the image and verbatim caption to `reports/figures/<arxivId>.png` and `.json`. These images are served via `/api/figures/<arxivId>` behind `ACCESS_PASSWORD`, and each saved briefing records its figure mapping in `figuresById` so archived briefings retain their figures.

### Full reports

Clicking <span class="ui-action">→ full report</span> opens a slide-over drawer displaying the complete Stage 4 deep-analysis report for that paper. The drawer renders Markdown structure (headings, lists, bold, italics, and inline code) into React elements without raw HTML injection. These Stage 4 full reports serve as the primary source evidence for both `/api/synthesize` and `/api/check-briefing`.

### Notes from the editor

After the hallucination audit finishes, `/api/editor-questions` (`prompts/editor-questions.md`) makes a compact call on `briefingModel` using your profile, the synthesized cards, the highest-scoring excluded papers, and recent feedback (including earlier answers). The validator in `lib/editorQuestions/questions.js` retains a question only if it ends with a question mark, provides two to four short answer options, and cites an `arxivId` from the input corpus. Validated questions are saved on the briefing as `editorQuestions`, and clicking an option records an `answer` feedback event.

### Generation metadata

Expanding <span class="ui-action">Generation details ▸</span> beneath the briefing displays the run provenance stored in `generationMetadata`:

- **Profile snapshot**: The active profile prose at generation time.
- **Stage model IDs**: `filterModel`, `scoringModel`, `pdfModel`, and `briefingModel`.
- **Categories and filter counts**: Selected arXiv subcategories and Stage 2 <span class="verdict is-yes">YES</span>, <span class="verdict is-maybe">MAYBE</span>, and <span class="verdict is-no">NO</span> counts.
- **Gate and retry flags**: `pauseAfterFilter`, `briefingRetryOnYes`, and `briefingRetryOnMaybe`.
- **Hallucination audit result**: Audit verdict (<span class="verdict is-yes">NO</span>, <span class="verdict is-maybe">MAYBE</span>, or <span class="verdict is-no">YES</span>), auditor justification, flagged claims list, and retry indicator.
- **Timestamp**: ISO 8601 completion time.

Attaching `generationMetadata` alongside the briefing object allows new provenance fields to be recorded without altering the synthesis schema.

## Hard constraints (from the prompt)

The synthesis prompt (`prompts/synthesis.md`) enforces strict citation and coverage invariants:

> - Copy every `arxivId` you emit, in `papers`, in `themes.paperIds`, and in prose such as the reading recommendation, exactly as it appears in the input list. Never invent, normalize, shorten, or reformat an ID, and don't cite an arXiv ID that isn't in the input list.
> - `papers` contains one entry per final-round paper in the input list.
> - `themes` contains at least one theme, and every paper in `papers` appears in at least one theme.

Field types and non-empty string requirements are enforced directly by the provider's structured-output schema and server-side Zod validation.

Both the synthesis prompt and the hallucination audit (`prompts/check-briefing.md`) distinguish paper-level factual claims from cross-paper editorial synthesis:

> - A factual claim about a paper (a number, a named method, dataset, or model, a comparative result, or a view you attribute to the authors) must be supported by that paper's `abstract` or `fullReport`. This holds wherever the claim appears, including inside a sentence that connects several papers. Do not invent findings, methodology details, author opinions, numbers, or conclusions.
> - Editorial synthesis (the thread several papers share, the tension between them, why a result matters for this user) is the briefing's job and needs no single source passage. It must not contradict any paper it cites, and it must not carry an unsupported factual claim.

## Checks before display

Every synthesized briefing passes through deterministic validation in `lib/synthesis/validator.js` before rendering:

**Automatic corrections** (applied silently in code and listed in the API response):

- Every card's `title` and `score` are overwritten with the ground-truth values from the input paper object.
- Duplicate cards and duplicate `arxivId` entries within a single theme are deduplicated.

**Validation rejections** (trigger a single LLM repair call with the explicit error list):

- Any card or `themes.paperIds` entry cites an `arxivId` outside the input list.
- Any prose field (executive summary, theme titles or arguments, pitches, or `whyMatters` paragraphs) cites an `arxivId` outside the input list.
- Any non-dismissed input paper (or any starred paper) is missing a card in `papers`.
- Any card is omitted from all themes, or a theme references an `arxivId` that has no card.

**Deterministic salvage** (applied in code if the LLM repair call fails or still violates a rule):

- Cards referencing unknown `arxivId`s are removed.
- Any omitted non-dismissed paper receives a fallback card whose pitch states _"Added by Aparture: the briefing model left this paper out"_.
- Theme references lacking a matching card are removed, along with any themes left empty.
- Cards that no theme lists are grouped under a fallback **Other papers** theme for the current final round.
- Unverified `arxivId` strings inside prose are replaced with _[unverified arXiv ID removed]_.

**Post-validation hallucination audit**: Once structural validation succeeds, `/api/check-briefing` audits all factual claims in the briefing against the untruncated abstracts and Stage 4 full reports, optionally triggering one synthesis retry when unsupported claims are flagged (see [The pipeline → The hallucination-retry loop](/concepts/pipeline#the-hallucination-retry-loop)). If the audit call itself fails twice, the briefing is saved as unaudited with the error recorded in `generationMetadata.hallucinationCheckError` and _claims check did not run_ shown in the header.

## Where to tune what

- **Adjusting briefing structure or tone**: Edit `prompts/synthesis.md`; changes take effect on the next synthesis run without rebuilding (see [Prompts](/reference/prompts)).
- **Adjusting visual styling**: Edit `styles/briefing.css`, where `--aparture-*` CSS custom properties control the briefing palette across light and dark modes.
- **Adjusting audit strictness**: Edit `prompts/check-briefing.md`, which is also reloaded from disk on every audit call.

## Next

Continue to [Reading a briefing →](/using/reading-a-briefing) for the reader workflow covering daily triage, inline expansions, and feedback controls.

Related guides:

- [**The pipeline**](/concepts/pipeline): How Stages 1 through 4 produce the inputs passed to synthesis.
- [**Prompts**](/reference/prompts): Complete guide to customizing Aparture's hot-reloadable prompt templates.
