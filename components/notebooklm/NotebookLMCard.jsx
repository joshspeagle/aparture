import { Download, FileAudio, Loader2 } from 'lucide-react';
import Card from '../ui/Card.jsx';
import Button from '../ui/Button.jsx';
import Select from '../ui/Select.jsx';
import { AVAILABLE_MODELS } from '../../utils/models.js';
import {
  PODCAST_LENGTHS,
  PODCAST_LENGTH_IDS,
  podcastLengthInfo,
} from '../../lib/notebooklm/podcastLength.js';

export default function NotebookLMCard({
  podcastDuration,
  setPodcastDuration,
  notebookLMModel,
  setNotebookLMModel,
  notebookLMGenerating,
  notebookLMStatus,
  notebookLMContent,
  onGenerateNotebookLM,
  processing,
  currentBriefing,
}) {
  if (!currentBriefing) return null;

  const disabled = notebookLMGenerating || processing.isRunning;
  const length = podcastLengthInfo(podcastDuration);

  return (
    <Card style={{ marginTop: 'var(--aparture-space-6)' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          marginBottom: 'var(--aparture-space-3)',
        }}
      >
        <FileAudio
          className="w-5 h-5"
          style={{ marginRight: '8px', color: 'var(--aparture-accent)' }}
        />
        <h2
          style={{
            fontFamily: 'var(--aparture-font-sans)',
            fontSize: 'var(--aparture-text-xl)',
            fontWeight: 600,
            margin: 0,
          }}
        >
          Podcast
        </h2>
      </div>

      <p
        style={{
          fontFamily: 'var(--aparture-font-sans)',
          fontSize: 'var(--aparture-text-sm)',
          color: 'var(--aparture-mute)',
          marginBottom: 'var(--aparture-space-3)',
        }}
      >
        Download a bundle containing the briefing, a podcast outline, and each paper&apos;s deep
        analysis, plus a focus prompt for Gemini Notebook (formerly NotebookLM). Extract the ZIP,
        add the <code>.md</code> files to a new notebook, paste <code>focus-prompt.txt</code> into
        the audio overview&apos;s customization box, and generate.
      </p>

      <div
        style={{
          display: 'flex',
          gap: 'var(--aparture-space-3)',
          marginBottom: 'var(--aparture-space-3)',
        }}
      >
        <label>
          Length
          <Select
            value={length.id}
            onChange={(e) => setPodcastDuration(e.target.value)}
            disabled={disabled}
          >
            {PODCAST_LENGTH_IDS.map((id) => (
              <option key={id} value={id}>
                {PODCAST_LENGTHS[id].label} ({PODCAST_LENGTHS[id].range})
              </option>
            ))}
          </Select>
        </label>
        <label>
          Model
          <Select
            value={notebookLMModel}
            onChange={(e) => setNotebookLMModel(e.target.value)}
            disabled={disabled}
          >
            {AVAILABLE_MODELS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </Select>
        </label>
      </div>

      <p
        style={{
          fontFamily: 'var(--aparture-font-sans)',
          fontSize: 'var(--aparture-text-sm)',
          color: 'var(--aparture-mute)',
          marginBottom: 'var(--aparture-space-3)',
        }}
      >
        The notebook&apos;s own length option decides the final length more than the focus prompt
        does: for a {length.label} episode, choose <strong>{length.notebookOption}</strong> there.
      </p>

      <Button variant="primary" disabled={disabled} onClick={onGenerateNotebookLM}>
        {notebookLMGenerating ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" /> Building bundle…
          </>
        ) : (
          <>
            <Download className="w-4 h-4" /> Generate podcast bundle
          </>
        )}
      </Button>

      {notebookLMStatus && !notebookLMGenerating && (
        <p
          style={{
            marginTop: 'var(--aparture-space-2)',
            fontSize: 'var(--aparture-text-sm)',
            color: notebookLMContent ? 'var(--aparture-ink)' : 'var(--aparture-accent)',
          }}
        >
          {notebookLMStatus}
        </p>
      )}
    </Card>
  );
}
