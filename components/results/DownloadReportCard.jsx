import { Download, TestTube } from 'lucide-react';

export default function DownloadReportCard({
  testState,
  processingTiming,
  results,
  processing,
  config,
  onExport,
}) {
  const hasReport = results.finalRanking.length > 0;

  return (
    <div className="bg-slate-900/50 backdrop-blur-sm rounded-xl p-6 mb-6 border border-slate-800">
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <div className="flex items-center mb-2">
            <Download className="w-5 h-5 mr-2 text-green-400" />
            <h2 className="text-xl font-semibold">Download Report</h2>
            {testState.dryRunInProgress && (
              <span className="ml-3 px-2 py-1 bg-yellow-900/30 text-yellow-400 text-xs rounded-full flex items-center gap-1">
                <TestTube className="w-3 h-3" />
                TEST DATA
              </span>
            )}
          </div>

          {processingTiming.startTime && (
            <div className="text-sm text-gray-400 mb-3">
              {processingTiming.endTime ? (
                <>
                  Completed: {processingTiming.endTime.toLocaleString()}
                  <span className="mx-2">•</span>
                  Duration:{' '}
                  {processingTiming.duration
                    ? Math.round(processingTiming.duration / 60000)
                    : 0}{' '}
                  minutes
                  <span className="mx-2">•</span>
                  {results.scoredPapers.length} abstracts screened
                  <span className="mx-2">•</span>
                  {Math.min(results.scoredPapers.length, config.maxDeepAnalysis)} papers analyzed
                  <span className="mx-2">•</span>
                  {results.finalRanking.length} papers summarized
                </>
              ) : processing.isRunning ? (
                <>
                  Started: {processingTiming.startTime.toLocaleString()}
                  <span className="mx-2">•</span>
                  Analysis in progress...
                </>
              ) : (
                `Last started: ${processingTiming.startTime.toLocaleString()}`
              )}
            </div>
          )}
        </div>

        <button
          onClick={onExport}
          disabled={!hasReport}
          className={`px-6 py-3 rounded-lg font-medium transition-all flex items-center gap-2 ${
            hasReport
              ? 'bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white'
              : 'bg-slate-700 text-slate-400 cursor-not-allowed'
          }`}
        >
          <Download className="w-4 h-4" />
          {hasReport ? 'Download Report' : 'No Report Available'}
        </button>
      </div>
    </div>
  );
}
