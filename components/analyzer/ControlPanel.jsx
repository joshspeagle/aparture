import {
  CheckCircle,
  ChevronDown,
  ChevronRight,
  Loader2,
  Pause,
  Play,
  RotateCcw,
  Square,
  TestTube,
  XCircle,
  Zap,
} from 'lucide-react';
import { useState } from 'react';

export default function ControlPanel({
  processing,
  testState,
  onStart,
  onPause,
  onResume,
  onStop,
  onReset,
  onRunDryRun,
  onRunMinimalTest,
}) {
  const [showTestDropdown, setShowTestDropdown] = useState(false);

  return (
    <div className="bg-slate-900/50 backdrop-blur-sm rounded-xl p-6 mb-6 border border-slate-800">
      <div className="flex items-center justify-between mb-4">
        <div className="flex gap-3">
          {!processing.isRunning && (
            <button
              onClick={onStart}
              className="px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-500 rounded-lg font-medium hover:from-blue-600 hover:to-purple-600 transition-all flex items-center gap-2"
            >
              <Play className="w-4 h-4" />
              Start Analysis
            </button>
          )}

          {processing.isRunning && !processing.isPaused && (
            <button
              onClick={onPause}
              className="px-4 py-2 bg-yellow-500 rounded-lg font-medium hover:bg-yellow-600 transition-colors flex items-center gap-2"
            >
              <Pause className="w-4 h-4" />
              Pause
            </button>
          )}

          {processing.isRunning && processing.isPaused && (
            <button
              onClick={onResume}
              className="px-4 py-2 bg-green-500 rounded-lg font-medium hover:bg-green-600 transition-colors flex items-center gap-2"
            >
              <Play className="w-4 h-4" />
              Resume
            </button>
          )}

          {processing.isRunning && (
            <button
              onClick={onStop}
              className="px-4 py-2 bg-red-500 rounded-lg font-medium hover:bg-red-600 transition-colors flex items-center gap-2"
            >
              <Square className="w-4 h-4" />
              Stop
            </button>
          )}

          <button
            onClick={onReset}
            className="px-4 py-2 bg-slate-700 rounded-lg font-medium hover:bg-slate-600 transition-colors flex items-center gap-2"
          >
            <RotateCcw className="w-4 h-4" />
            Reset
          </button>
        </div>
      </div>

      <div>
        <button
          onClick={() => setShowTestDropdown(!showTestDropdown)}
          className="flex items-center text-sm text-gray-400 hover:text-white transition-colors"
        >
          {showTestDropdown ? (
            <ChevronDown className="w-4 h-4 mr-1" />
          ) : (
            <ChevronRight className="w-4 h-4 mr-1" />
          )}
          System Tests
        </button>

        {showTestDropdown && (
          <div className="mt-3 space-y-3 pl-5 border-l-2 border-slate-700">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
                <div className="flex items-center mb-2">
                  <div
                    className={`w-3 h-3 rounded-full mr-2 ${testState.dryRunCompleted ? 'bg-green-400' : 'bg-slate-500'}`}
                  />
                  <h3 className="font-medium">Dry Run Test</h3>
                </div>
                <p className="text-sm text-gray-400 mb-3">
                  Tests all components with mock APIs. No API costs incurred.
                </p>
                {testState.lastDryRunTime && (
                  <p className="text-xs text-gray-500 mb-3">
                    Last run: {testState.lastDryRunTime.toLocaleString()}
                  </p>
                )}
                <button
                  onClick={onRunDryRun}
                  disabled={testState.dryRunInProgress || processing.isRunning}
                  className={`w-full px-4 py-2 rounded-lg font-medium transition-all flex items-center justify-center gap-2 ${
                    testState.dryRunInProgress || processing.isRunning
                      ? 'bg-slate-700 text-slate-400 cursor-not-allowed'
                      : 'bg-cyan-500 hover:bg-cyan-600 text-white'
                  }`}
                >
                  {testState.dryRunInProgress ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Testing...
                    </>
                  ) : testState.dryRunCompleted ? (
                    <>
                      <CheckCircle className="w-4 h-4" />
                      Run Again
                    </>
                  ) : (
                    <>
                      <TestTube className="w-4 h-4" />
                      Run Dry Test
                    </>
                  )}
                </button>
              </div>

              <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
                <div className="flex items-center mb-2">
                  <div
                    className={`w-3 h-3 rounded-full mr-2 ${testState.lastMinimalTestTime ? 'bg-green-400' : 'bg-slate-500'}`}
                  />
                  <h3 className="font-medium">Minimal API Test</h3>
                </div>
                <p className="text-sm text-gray-400 mb-3">
                  Tests with 5 hardcoded papers using real APIs. Incurs costs.
                </p>
                {testState.lastMinimalTestTime && (
                  <p className="text-xs text-gray-500 mb-3">
                    Last run: {testState.lastMinimalTestTime.toLocaleString()}
                  </p>
                )}
                <button
                  onClick={onRunMinimalTest}
                  disabled={
                    !testState.dryRunCompleted ||
                    testState.minimalTestInProgress ||
                    processing.isRunning
                  }
                  className={`w-full px-4 py-2 rounded-lg font-medium transition-all flex items-center justify-center gap-2 ${
                    !testState.dryRunCompleted ||
                    testState.minimalTestInProgress ||
                    processing.isRunning
                      ? 'bg-slate-700 text-slate-400 cursor-not-allowed'
                      : 'bg-orange-500 hover:bg-orange-600 text-white'
                  }`}
                >
                  {testState.minimalTestInProgress ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Testing...
                    </>
                  ) : !testState.dryRunCompleted ? (
                    <>
                      <XCircle className="w-4 h-4" />
                      Run Dry Test First
                    </>
                  ) : (
                    <>
                      <Zap className="w-4 h-4" />
                      Run API Test
                    </>
                  )}
                </button>
              </div>
            </div>

            <div className="text-xs text-gray-400">
              <strong>Testing workflow:</strong> Run the dry test first to verify all components
              work correctly without API costs. Then run the minimal test to confirm real API
              integration with a small set of papers.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
