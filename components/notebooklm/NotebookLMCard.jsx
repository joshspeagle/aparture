import { AlertCircle, Download, FileText, Loader2, TestTube } from 'lucide-react';
import { AVAILABLE_MODELS } from '../../utils/models';
import Button from '../ui/Button.jsx';
import Card from '../ui/Card.jsx';
import Checkbox from '../ui/Checkbox.jsx';
import Select from '../ui/Select.jsx';

export default function NotebookLMCard({
  currentBriefing,
  testState,
  podcastDuration,
  setPodcastDuration,
  notebookLMModel,
  setNotebookLMModel,
  notebookLMGenerating,
  notebookLMStatus,
  notebookLMContent,
  enableHallucinationCheck,
  setEnableHallucinationCheck,
  hallucinationWarning,
  results,
  onGenerate,
  onDownload,
}) {
  if (!currentBriefing) return null;

  const labelStyle = {
    display: 'block',
    fontFamily: 'var(--aparture-font-sans)',
    fontSize: 'var(--aparture-text-xs)',
    fontWeight: 500,
    color: 'var(--aparture-mute)',
    marginBottom: '8px',
  };

  const testBadgeStyle = {
    marginLeft: '12px',
    padding: '2px 8px',
    background: 'rgba(245,158,11,0.12)',
    color: '#f59e0b',
    fontSize: 'var(--aparture-text-xs)',
    borderRadius: '9999px',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
  };

  return (
    <Card>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 'var(--aparture-space-4)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <FileText
            className="w-5 h-5"
            style={{ marginRight: '8px', color: 'var(--aparture-accent)' }}
          />
          <h2
            style={{
              fontFamily: 'var(--aparture-font-sans)',
              fontSize: 'var(--aparture-text-xl)',
              fontWeight: 600,
              color: 'var(--aparture-ink)',
            }}
          >
            NotebookLM Podcast Generation
          </h2>
          {testState.dryRunInProgress && (
            <span style={testBadgeStyle}>
              <TestTube className="w-3 h-3" />
              TEST MODE
            </span>
          )}
        </div>

        <Checkbox
          checked={enableHallucinationCheck}
          onChange={(e) => setEnableHallucinationCheck(e.target.checked)}
          label="Enable hallucination check &amp; retry"
        />
      </div>

      <p
        style={{
          fontFamily: 'var(--aparture-font-sans)',
          fontSize: 'var(--aparture-text-sm)',
          color: 'var(--aparture-mute)',
          marginBottom: 'var(--aparture-space-4)',
        }}
      >
        Generate a structured document optimized for NotebookLM to create an expert-level podcast
        discussion. Uses the briefing above as editorial framing when available.
      </p>

      {hallucinationWarning && (
        <div
          style={{
            marginBottom: 'var(--aparture-space-4)',
            padding: 'var(--aparture-space-3)',
            background: 'rgba(245,158,11,0.08)',
            border: '1px solid rgba(245,158,11,0.3)',
            borderRadius: '4px',
          }}
        >
          <p
            style={{
              color: '#f59e0b',
              fontFamily: 'var(--aparture-font-sans)',
              fontSize: 'var(--aparture-text-sm)',
              fontWeight: 500,
              marginBottom: '8px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <AlertCircle className="w-4 h-4" />
            Hallucination detected and corrected
          </p>
          {hallucinationWarning.issues && hallucinationWarning.issues.length > 0 && (
            <>
              <p
                style={{
                  color: 'var(--aparture-ink)',
                  fontFamily: 'var(--aparture-font-sans)',
                  fontSize: 'var(--aparture-text-xs)',
                  marginBottom: '8px',
                }}
              >
                {hallucinationWarning.summary}
              </p>
              <details
                style={{
                  color: 'var(--aparture-ink)',
                  fontFamily: 'var(--aparture-font-sans)',
                  fontSize: 'var(--aparture-text-xs)',
                }}
              >
                <summary style={{ cursor: 'pointer' }}>View details</summary>
                <ul style={{ marginTop: '8px', paddingLeft: '16px', listStyle: 'disc' }}>
                  {hallucinationWarning.issues.map((issue, i) => (
                    <li key={i} style={{ marginBottom: '4px' }}>
                      {issue}
                    </li>
                  ))}
                </ul>
              </details>
            </>
          )}
          {hallucinationWarning.resolved ? (
            <p
              style={{
                color: '#22c55e',
                fontFamily: 'var(--aparture-font-sans)',
                fontSize: 'var(--aparture-text-xs)',
                marginTop: '8px',
              }}
            >
              &#10003; Successfully corrected with strict generation mode
            </p>
          ) : (
            <p
              style={{
                color: '#f97316',
                fontFamily: 'var(--aparture-font-sans)',
                fontSize: 'var(--aparture-text-xs)',
                marginTop: '8px',
              }}
            >
              &#9888;&#65039; Some issues may persist - please review carefully
            </p>
          )}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--aparture-space-4)' }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 'var(--aparture-space-4)',
          }}
        >
          <div>
            <label style={labelStyle}>Target Podcast Duration</label>
            <Select
              value={podcastDuration}
              onChange={(e) => setPodcastDuration(Number(e.target.value))}
              disabled={notebookLMGenerating}
            >
              <option value="5">5 minutes - Quick Overview</option>
              <option value="10">10 minutes - Standard Discussion</option>
              <option value="15">15 minutes - Detailed Analysis</option>
              <option value="20">20 minutes - In-depth Coverage (Recommended)</option>
              <option value="30">30 minutes - Comprehensive Review</option>
            </Select>
          </div>

          <div>
            <label style={labelStyle}>Generation Model</label>
            <Select
              value={notebookLMModel}
              onChange={(e) => setNotebookLMModel(e.target.value)}
              disabled={notebookLMGenerating}
            >
              {AVAILABLE_MODELS.map((model) => (
                <option key={model.id} value={model.id}>
                  {model.name}
                </option>
              ))}
            </Select>
          </div>
        </div>

        <div
          style={{
            padding: '8px',
            background: 'var(--aparture-bg)',
            borderRadius: '4px',
          }}
        >
          <p
            style={{
              fontFamily: 'var(--aparture-font-sans)',
              fontSize: 'var(--aparture-text-xs)',
              color: 'var(--aparture-ink)',
            }}
          >
            <span style={{ color: 'var(--aparture-mute)' }}>Model: </span>
            {AVAILABLE_MODELS.find((m) => m.id === notebookLMModel)?.description}
          </p>
        </div>

        {notebookLMStatus && (
          <div
            style={{
              padding: 'var(--aparture-space-3)',
              borderRadius: '4px',
              fontFamily: 'var(--aparture-font-sans)',
              fontSize: 'var(--aparture-text-sm)',
              ...(notebookLMStatus.includes('Error')
                ? {
                    background: 'rgba(239,68,68,0.08)',
                    color: '#ef4444',
                    border: '1px solid rgba(239,68,68,0.3)',
                  }
                : notebookLMStatus.includes('successfully')
                  ? {
                      background: 'rgba(34,197,94,0.08)',
                      color: '#22c55e',
                      border: '1px solid rgba(34,197,94,0.3)',
                    }
                  : {
                      background: 'rgba(59,130,246,0.08)',
                      color: '#3b82f6',
                      border: '1px solid rgba(59,130,246,0.3)',
                    }),
            }}
          >
            {notebookLMStatus}
          </div>
        )}

        <div style={{ display: 'flex', gap: 'var(--aparture-space-3)' }}>
          <Button
            variant="primary"
            onClick={onGenerate}
            disabled={notebookLMGenerating || results.scoredPapers.length === 0}
          >
            {notebookLMGenerating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <FileText className="w-4 h-4" />
                Generate NotebookLM File
              </>
            )}
          </Button>

          {notebookLMContent && (
            <Button
              variant="secondary"
              onClick={onDownload}
              style={{
                borderColor: '#22c55e',
                color: '#22c55e',
              }}
            >
              <Download className="w-4 h-4" />
              Download NotebookLM Document
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}
