const REQUIRED_SLOTS = ['profile', 'papers'];

export function renderSynthesisPrompt(template, context) {
  for (const slot of REQUIRED_SLOTS) {
    if (!template.includes(`{{${slot}}}`)) {
      throw new Error(`missing template slot: {{${slot}}}`);
    }
  }
  let out = template;
  // Function replacements: string values would get GetSubstitution
  // semantics ($$, $&, $`, $') and corrupt LaTeX-bearing content.
  out = out.replaceAll('{{profile}}', () => context.profile ?? '');
  out = out.replaceAll('{{papers}}', () => JSON.stringify(context.papers ?? [], null, 2));
  return out;
}
