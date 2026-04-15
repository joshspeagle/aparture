import { AlertCircle, Loader2, TestTube, Zap } from 'lucide-react';
import { useState } from 'react';

export default function ProgressTracker({
  processing,
  testState,
  getStageDisplay,
  getProgressPercentage,
}) {
  const [showErrors, setShowErrors] = useState(false);

  return (
    <div className="bg-slate-900/50 backdrop-blur-sm rounded-xl p-6 mb-6 border border-slate-800">
      <div className="flex items-center mb-4">
        <Zap className="w-5 h-5 mr-2 text-yellow-400" />
        <h2 className="text-xl font-semibold">Progress</h2>
        {testState.dryRunInProgress && (
          <span className="ml-3 px-2 py-1 bg-yellow-900/30 text-yellow-400 text-xs rounded-full flex items-center gap-1">
            <TestTube className="w-3 h-3" />
            DRY RUN MODE
          </span>
        )}
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-gray-300">Current Stage:</span>
          <span className="font-medium flex items-center gap-2">
            {processing.isRunning && <Loader2 className="w-4 h-4 animate-spin" />}
            {getStageDisplay()}
            {processing.isPaused && <span className="text-yellow-400">(Paused)</span>}
          </span>
        </div>

        {processing.progress.total > 0 && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm text-gray-400">
              <span>Progress</span>
              <span>
                {processing.progress.current} / {processing.progress.total}{' '}
                {processing.stage === 'fetching' ? 'categories' : 'papers'}
              </span>
            </div>
            <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
              <div
                className="bg-gradient-to-r from-blue-500 to-purple-500 h-full transition-all duration-300"
                style={{ width: `${getProgressPercentage()}%` }}
              />
            </div>
          </div>
        )}

        {processing.errors.length > 0 && (
          <div>
            <button
              onClick={() => setShowErrors(!showErrors)}
              className="flex items-center text-sm text-red-400 hover:text-red-300 transition-colors"
            >
              <AlertCircle className="w-4 h-4 mr-1" />
              {showErrors ? 'Hide' : 'Show'} Logs ({processing.errors.length})
            </button>

            {showErrors && (
              <div className="mt-2 max-h-40 overflow-y-auto bg-slate-800 rounded-lg p-3 text-xs text-red-300 font-mono">
                {processing.errors.map((error, idx) => (
                  <div key={idx} className="mb-1">
                    {error}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
