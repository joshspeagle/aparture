// Static three-step workflow content shipped inside every NotebookLM
// bundle. Pinned as a string constant so we don't ship an asset file
// just for static copy.

export const INSTRUCTIONS_MD = `# NotebookLM Bundle — Instructions

This bundle is an audio substitute for today's briefing. Follow these three steps to turn it into a podcast.

## 1. Extract this folder

NotebookLM does not accept ZIP uploads directly. Right-click the ZIP you downloaded and choose "Extract All" (or equivalent on your OS) so you end up with a folder of \`.md\` files plus \`focus-prompt.txt\`.

## 2. Upload the markdown files to NotebookLM

Create a new notebook at https://notebooklm.google.com/ and drag-and-drop **every \`.md\` file** from the extracted folder into the "Add sources" area at once. That includes:

- \`briefing.md\`
- \`discussion-guide.md\`
- Everything under \`papers/\`

Do **not** upload \`focus-prompt.txt\` or \`INSTRUCTIONS.md\` as sources — those are for step 3 and this file respectively.

## 3. Customize the audio overview and generate

In the new notebook, click **Audio Overview → Customize** (or the pencil icon). Paste the entire contents of \`focus-prompt.txt\` into the customization textarea, then click **Generate**.

The resulting podcast will be an expert-to-expert discussion of today's papers, with paper titles and arXiv IDs called out clearly enough to flag for later reading.
`;
