// Starter profile templates for first-run setup.
//
// Fresh installs ship with the neutral BLANK_PROFILE_TEMPLATE below as both
// DEFAULT_CONFIG.scoringCriteria and (via the useProfile seed path) the
// initial profile content. The template picker in
// components/profile/StarterTemplatePicker.jsx offers these entries until the
// user makes their first profile edit or dismisses it.
//
// Each entry: { id, name, description, profileText, categories }.
// The first entry is the featured one (lead persona: focused researcher with
// a narrow profile). Descriptions are single plain sentences (POSITIONING.md
// §9 voice rules).

// The bracketed fill-in template. Also the shipped default profile — keep in
// sync with the worked starter block in docs/using/first-briefing.md.
export const BLANK_PROFILE_TEMPLATE = `I am a researcher working on [YOUR FIELD]. I care most about methodological
papers — new algorithms, models, or theoretical results — rather than
applied-only or incremental benchmark work.

Topics I actively follow:
- [METHOD FAMILY 1]
- [METHOD FAMILY 2]
- [APPLICATION DOMAIN]

I have some interest in adjacent work that uses these methods in novel ways,
but less interest in pure applications of well-established techniques.

I'm not interested in:
- Purely empirical leaderboard papers with no methodological contribution
- Vision-only papers unless they introduce a broadly useful technique
- Engineering or systems work without a research angle`;

// Narrow single-subfield profile — the worked example from
// docs/using/writing-a-profile.md, kept verbatim where possible.
const FOCUSED_PROFILE = `I work on hierarchical Bayesian models for galaxy population inference in
observational cosmology. Specifically, I care about methods that let us
combine noisy per-object measurements (redshifts, luminosities, shapes)
into population-level statements about galaxy evolution, large-scale
structure, or cosmological parameters.

Methodological topics I actively follow:

- Hierarchical Bayes and selection-effect modelling
- Simulation-based inference (ABC, neural density estimation,
  normalizing flows)
- Gaussian processes and their kernels for astronomical time series
- Model comparison via marginal likelihoods

I also follow adjacent work in statistics and machine learning when it
introduces tools that transfer to my setting (e.g. a new SBI method
benchmarked on a toy problem is relevant; a new image-classification
benchmark is not).

Not interested in:

- Pure N-body simulations or purely theoretical cosmology without an
  inferential contribution
- Vision-only deep-learning papers
- Reinforcement learning`;

// Broad multi-archive profile — previously the shipped default
// (DEFAULT_CONFIG.scoringCriteria before 2026-07), now offered as the
// breadth/power-user example with its original category list.
const BREADTH_PROFILE = `**Core Methodological Interests:**
**Statistical Learning:** Deep learning advances, general ML methods, novel architectures and training techniques with practical applications
**Uncertainty Quantification & Robustness:** Principled approaches to model uncertainty, calibration, conformal prediction, robustness evaluation, out-of-distribution detection, Bayesian deep learning
**Mechanistic Interpretability:** Understanding how models work internally, feature attribution, causal discovery in neural networks—not just making them "more honest" through prompting
**Advanced Statistical Methods:** Novel sampling/inference techniques, variational inference, hierarchical modeling, state space models, time series analysis, probabilistic programming innovations
**AI for Scientific Discovery:** Methods specifically designed to accelerate scientific understanding, not just routine applications of existing ML to new domains. Be highly selective with LLM papers—only major architectural innovations or fundamental breakthroughs, not incremental applications or fine-tuning studies.

**Astrophysics Domain Interests:**
**Galaxy Formation & Evolution:** Observational studies of galaxy assembly, galaxy populations, high-redshift galaxies, environmental effects, chemical evolution, quenching, morphological evolution
**Stellar Populations & Evolution:** Stellar activity, stellar populations as galactic tracers, stellar physics and evolution, star clusters, star formation processes
**Milky Way Structure & Dynamics:** Galactic structure, stellar kinematics, dark matter distribution, Galactic archaeology, stellar streams, near-field cosmology
**Large Survey Science:** Multi-wavelength surveys, time-domain astronomy, statistical methods for large astronomical datasets, survey strategy and design

**Research Philosophy:** Values EITHER (1) fundamental methodological advances in general OR (2) significant observational/data-driven astrophysical insights. Papers excelling in ANY category above should score highly - they do NOT need to match multiple domains. A landmark ML paper should score as highly as a landmark astrophysics paper. Focus on work that advances understanding through empirical analysis rather than purely theoretical frameworks.`;

const APPLIED_ML_PROFILE = `I am an applied machine-learning researcher. I care about methods I can
actually use: new architectures, training and fine-tuning techniques with
demonstrated gains on real tasks, and rigorous evaluation work such as
benchmark design, ablation methodology, and statistical testing for model
comparison.

Topics I actively follow:
- Parameter-efficient fine-tuning and adaptation of large models
- Evaluation methodology: benchmark construction, contamination, ablations
- Robustness and generalization under distribution shift
- Data curation and its effect on downstream performance

I'm not interested in:
- Theory papers without an empirical component
- Leaderboard entries without a methodological contribution
- Position papers and surveys`;

export const STARTER_TEMPLATES = [
  {
    id: 'focused-example',
    name: 'Focused: Bayesian cosmology',
    description:
      'A narrow single-subfield profile: hierarchical Bayesian inference for galaxy populations.',
    profileText: FOCUSED_PROFILE,
    categories: ['astro-ph.CO', 'astro-ph.IM'],
  },
  {
    id: 'breadth-example',
    name: 'Breadth: ML + statistics + astrophysics',
    description:
      'A broad multi-archive profile spanning three fields — the power-user example, and the most expensive to run.',
    profileText: BREADTH_PROFILE,
    categories: [
      'cs.AI',
      'cs.CL',
      'cs.CV',
      'cs.IR',
      'cs.LG',
      'cs.MA',
      'cs.NE',
      'stat.AP',
      'stat.CO',
      'stat.ME',
      'stat.ML',
      'stat.OT',
      'stat.TH',
      'astro-ph.CO',
      'astro-ph.EP',
      'astro-ph.GA',
      'astro-ph.HE',
      'astro-ph.IM',
      'astro-ph.SR',
    ],
  },
  {
    id: 'applied-ml-example',
    name: 'Applied machine learning',
    description: 'An applied-ML profile focused on usable methods and rigorous evaluation.',
    profileText: APPLIED_ML_PROFILE,
    categories: ['cs.LG', 'stat.ML', 'cs.CL'],
  },
  {
    id: 'blank',
    name: 'Fill-in template',
    description:
      'The bracketed template: replace the placeholders with your own field and methods.',
    profileText: BLANK_PROFILE_TEMPLATE,
    categories: ['cs.LG', 'stat.ML'],
  },
];

// True when the profile is still exactly the shipped template with no edit
// history — the signal StarterTemplatePicker uses to decide whether the user
// has ever saved a profile edit.
export function isUneditedProfile(profile) {
  if (!profile) return true;
  const noHistory = (profile.revisions?.length ?? 0) === 0;
  return noHistory && (profile.content ?? '') === BLANK_PROFILE_TEMPLATE;
}
