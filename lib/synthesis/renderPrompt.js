const REQUIRED_SLOTS = ['profile', 'papers'];

export function renderSynthesisPrompt(template, context) {
  for (const slot of REQUIRED_SLOTS) {
    if (!template.includes(`{{${slot}}}`)) {
      throw new Error(`missing template slot: {{${slot}}}`);
    }
  }
  let out = template;
  out = out.replaceAll('{{profile}}', context.profile ?? '');
  out = out.replaceAll('{{papers}}', JSON.stringify(context.papers ?? [], null, 2));
  return out;
}
