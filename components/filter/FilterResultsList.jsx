import { FileText, TestTube } from 'lucide-react';

function FilterResultRow({ paper, verdict, borderClass, processingIsRunning, onCycleVerdict }) {
  const pillClass =
    verdict === 'YES'
      ? 'bg-green-900/40 text-green-300 border-green-700 hover:border-green-500'
      : verdict === 'MAYBE'
        ? 'bg-yellow-900/40 text-yellow-300 border-yellow-700 hover:border-yellow-500'
        : 'bg-red-900/40 text-red-300 border-red-700 hover:border-red-500';
  const overridden = paper.originalVerdict && paper.originalVerdict !== verdict;

  return (
    <div className={`bg-slate-800/50 rounded-lg p-3 border ${borderClass}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-medium text-white">{paper.title}</h4>
          <p className="text-xs text-gray-400 mt-1">
            {paper.authors.length > 2 ? `${paper.authors[0]} et al.` : paper.authors.join(', ')}
          </p>
          {paper.filterSummary && (
            <p className="text-xs text-slate-300 italic mt-2">{paper.filterSummary}</p>
          )}
          {paper.filterJustification && (
            <p className="text-xs text-slate-500 mt-1">
              <span className="font-medium">Verdict reasoning:</span> {paper.filterJustification}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={() => onCycleVerdict(paper.id, verdict)}
          title={
            overridden
              ? `Filter originally said ${paper.originalVerdict}. Click to cycle.`
              : 'Click to override the filter verdict (cycles YES → MAYBE → NO)'
          }
          disabled={processingIsRunning}
          className={`shrink-0 px-2 py-1 text-[10px] uppercase tracking-wider rounded-full border transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${pillClass}`}
        >
          {verdict}
          {overridden && <span className="ml-1">⇄</span>}
        </button>
      </div>
    </div>
  );
}

export default function FilterResultsList({
  filterResults,
  filterSortedPapers,
  testState,
  processing,
  onCycleVerdict,
}) {
  const hasAny =
    filterResults.yes.length > 0 || filterResults.maybe.length > 0 || filterResults.no.length > 0;
  if (!hasAny) return null;

  const { unscoredYes, unscoredMaybe, unscoredNo, scoredYesCount, scoredMaybeCount } =
    filterSortedPapers;

  return (
    <div className="bg-slate-900/50 backdrop-blur-sm rounded-xl p-6 mb-6 border border-slate-800">
      <div className="flex items-center mb-4">
        <FileText className="w-5 h-5 mr-2 text-yellow-400" />
        <h2 className="text-xl font-semibold">
          Filtered Papers
          {filterResults.inProgress && (
            <span className="text-sm text-gray-400 ml-2">
              (Processing batch {filterResults.currentBatch || 0} of{' '}
              {filterResults.totalBatches || 0})
            </span>
          )}
        </h2>
        {testState.dryRunInProgress && (
          <span className="ml-3 px-2 py-1 bg-yellow-900/30 text-yellow-400 text-xs rounded-full flex items-center gap-1">
            <TestTube className="w-3 h-3" />
            TEST DATA
          </span>
        )}
      </div>

      <div className="space-y-4">
        {unscoredYes.length > 0 && (
          <div>
            <h3 className="text-sm font-medium mb-2 text-green-400">
              ✓ YES ({unscoredYes.length})
              {scoredYesCount > 0 && (
                <span className="text-xs text-gray-400 ml-2">({scoredYesCount} scored)</span>
              )}
            </h3>
            <div className="space-y-2 max-h-[800px] overflow-y-auto pr-2">
              {unscoredYes.map((paper) => (
                <FilterResultRow
                  key={paper.id}
                  paper={paper}
                  verdict="YES"
                  borderClass="border-green-900/50"
                  processingIsRunning={processing.isRunning}
                  onCycleVerdict={onCycleVerdict}
                />
              ))}
            </div>
          </div>
        )}

        {unscoredMaybe.length > 0 && (
          <div>
            <h3 className="text-sm font-medium mb-2 text-yellow-400">
              ? MAYBE ({unscoredMaybe.length})
              {scoredMaybeCount > 0 && (
                <span className="text-xs text-gray-400 ml-2">({scoredMaybeCount} scored)</span>
              )}
            </h3>
            <div className="space-y-2 max-h-[800px] overflow-y-auto pr-2">
              {unscoredMaybe.map((paper) => (
                <FilterResultRow
                  key={paper.id}
                  paper={paper}
                  verdict="MAYBE"
                  borderClass="border-yellow-900/50"
                  processingIsRunning={processing.isRunning}
                  onCycleVerdict={onCycleVerdict}
                />
              ))}
            </div>
          </div>
        )}

        {unscoredNo.length > 0 && (
          <div>
            <h3 className="text-sm font-medium mb-2 text-red-400">
              ✗ NO ({unscoredNo.length} filtered out)
            </h3>
            <div className="space-y-2 max-h-[600px] overflow-y-auto pr-2">
              {unscoredNo.map((paper) => (
                <FilterResultRow
                  key={paper.id}
                  paper={paper}
                  verdict="NO"
                  borderClass="border-red-900/50"
                  processingIsRunning={processing.isRunning}
                  onCycleVerdict={onCycleVerdict}
                />
              ))}
            </div>
          </div>
        )}

        {(unscoredYes.length > 0 || unscoredMaybe.length > 0 || unscoredNo.length > 0) && (
          <div className="pt-3 border-t border-slate-700 text-xs text-gray-400">
            <div className="flex justify-between">
              <span>
                Filtered:{' '}
                {filterResults.yes.length + filterResults.maybe.length + filterResults.no.length}{' '}
                papers
              </span>
              <span>Remaining to score: {unscoredYes.length + unscoredMaybe.length}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
