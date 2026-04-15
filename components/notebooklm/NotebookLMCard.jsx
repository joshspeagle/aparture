import { AlertCircle, Download, FileText, Loader2, TestTube } from 'lucide-react';
import { AVAILABLE_MODELS } from '../../utils/models';

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

  return (
    <div className="bg-slate-900/50 backdrop-blur-sm rounded-xl p-6 mb-6 border border-slate-800">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center">
          <FileText className="w-5 h-5 mr-2 text-purple-400" />
          <h2 className="text-xl font-semibold">NotebookLM Podcast Generation</h2>
          {testState.dryRunInProgress && (
            <span className="ml-3 px-2 py-1 bg-yellow-900/30 text-yellow-400 text-xs rounded-full flex items-center gap-1">
              <TestTube className="w-3 h-3" />
              TEST MODE
            </span>
          )}
        </div>

        <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
          <input
            type="checkbox"
            checked={enableHallucinationCheck}
            onChange={(e) => setEnableHallucinationCheck(e.target.checked)}
            className="rounded border-gray-600 text-purple-500 focus:ring-purple-500"
          />
          Enable hallucination check & retry
        </label>
      </div>

      <p className="text-sm text-gray-400 mb-4">
        Generate a structured document optimized for NotebookLM to create an expert-level podcast
        discussion. Uses the briefing above as editorial framing when available.
      </p>

      {hallucinationWarning && (
        <div className="mb-4 p-3 bg-yellow-900/20 border border-yellow-700 rounded-lg">
          <p className="text-yellow-400 text-sm font-medium mb-2 flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            Hallucination detected and corrected
          </p>
          {hallucinationWarning.issues && hallucinationWarning.issues.length > 0 && (
            <>
              <p className="text-yellow-300 text-xs mb-2">{hallucinationWarning.summary}</p>
              <details className="text-yellow-300 text-xs">
                <summary className="cursor-pointer hover:text-yellow-200">View details</summary>
                <ul className="mt-2 space-y-1 pl-4">
                  {hallucinationWarning.issues.map((issue, i) => (
                    <li key={i} className="list-disc">
                      {issue}
                    </li>
                  ))}
                </ul>
              </details>
            </>
          )}
          {hallucinationWarning.resolved ? (
            <p className="text-green-400 text-xs mt-2">
              ✓ Successfully corrected with strict generation mode
            </p>
          ) : (
            <p className="text-orange-400 text-xs mt-2">
              ⚠️ Some issues may persist - please review carefully
            </p>
          )}
        </div>
      )}

      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-2">
              Target Podcast Duration
            </label>
            <select
              value={podcastDuration}
              onChange={(e) => setPodcastDuration(Number(e.target.value))}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-white text-sm"
              disabled={notebookLMGenerating}
            >
              <option value="5">5 minutes - Quick Overview</option>
              <option value="10">10 minutes - Standard Discussion</option>
              <option value="15">15 minutes - Detailed Analysis</option>
              <option value="20">20 minutes - In-depth Coverage (Recommended)</option>
              <option value="30">30 minutes - Comprehensive Review</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-400 mb-2">Generation Model</label>
            <select
              value={notebookLMModel}
              onChange={(e) => setNotebookLMModel(e.target.value)}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-white text-sm"
              disabled={notebookLMGenerating}
            >
              {AVAILABLE_MODELS.map((model) => (
                <option key={model.id} value={model.id}>
                  {model.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="p-2 bg-slate-800/50 rounded-lg">
          <p className="text-xs text-gray-300">
            <span className="text-gray-400">Model: </span>
            {AVAILABLE_MODELS.find((m) => m.id === notebookLMModel)?.description}
          </p>
        </div>

        {notebookLMStatus && (
          <div
            className={`p-3 rounded-lg text-sm ${
              notebookLMStatus.includes('Error')
                ? 'bg-red-900/20 text-red-400 border border-red-800'
                : notebookLMStatus.includes('successfully')
                  ? 'bg-green-900/20 text-green-400 border border-green-800'
                  : 'bg-blue-900/20 text-blue-400 border border-blue-800'
            }`}
          >
            {notebookLMStatus}
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={onGenerate}
            disabled={notebookLMGenerating || results.scoredPapers.length === 0}
            className={`px-6 py-3 rounded-lg font-medium transition-all flex items-center gap-2 ${
              notebookLMGenerating || results.scoredPapers.length === 0
                ? 'bg-slate-700 text-slate-400 cursor-not-allowed'
                : 'bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white'
            }`}
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
          </button>

          {notebookLMContent && (
            <button
              onClick={onDownload}
              className="px-6 py-3 rounded-lg font-medium transition-all flex items-center gap-2 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white"
            >
              <Download className="w-4 h-4" />
              Download NotebookLM Document
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
