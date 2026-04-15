import { FileText, TestTube } from 'lucide-react';

export default function AnalysisResultsList({
  results,
  testState,
  processing,
  abstractOnlyPapers,
  renderPaperCard,
}) {
  if (results.scoredPapers.length === 0 && results.finalRanking.length === 0) return null;

  const showTwoSections =
    results.finalRanking.length > 0 &&
    (processing.stage === 'deep-analysis' || processing.stage === 'complete');

  return (
    <div className="bg-slate-900/50 backdrop-blur-sm rounded-xl p-6 mb-6 border border-slate-800">
      <div className="flex items-center mb-4">
        <FileText className="w-5 h-5 mr-2 text-green-400" />
        <h2 className="text-xl font-semibold">
          {results.finalRanking.length > 0 ? 'Analysis Results' : 'Scored Papers'}
        </h2>
        {testState.dryRunInProgress && (
          <span className="ml-3 px-2 py-1 bg-yellow-900/30 text-yellow-400 text-xs rounded-full flex items-center gap-1">
            <TestTube className="w-3 h-3" />
            TEST DATA
          </span>
        )}
      </div>

      {showTwoSections ? (
        <div className="space-y-6">
          <div>
            <h3 className="text-lg font-medium mb-3 text-blue-400">
              📄 Papers with Deep PDF Analysis ({results.finalRanking.length})
            </h3>
            <div className="space-y-2 max-h-[1000px] overflow-y-auto pr-2">
              {results.finalRanking.map((paper, idx) => renderPaperCard(paper, idx, true))}
            </div>
          </div>

          {abstractOnlyPapers.length > 0 && (
            <div>
              <h3 className="text-lg font-medium mb-3 text-gray-400">
                📋 Abstract-Only Scores ({abstractOnlyPapers.length})
              </h3>
              <div className="space-y-2 max-h-[750px] overflow-y-auto pr-2">
                {abstractOnlyPapers.map((paper, idx) =>
                  renderPaperCard(paper, results.finalRanking.length + idx, false)
                )}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-2 max-h-[500px] overflow-y-auto pr-2">
          {results.scoredPapers.map((paper, idx) => renderPaperCard(paper, idx, false))}
        </div>
      )}
    </div>
  );
}
