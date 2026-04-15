import { Loader2, Newspaper, TestTube } from 'lucide-react';

export default function BriefingCard({
  results,
  testState,
  synthesizing,
  synthesisError,
  briefingCheckResult,
  briefingStage,
  processing,
  onGenerate,
}) {
  if (!results?.finalRanking?.length) return null;

  return (
    <div className="bg-slate-900/50 backdrop-blur-sm rounded-xl p-6 mb-6 border border-slate-800">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center">
          <Newspaper className="w-5 h-5 mr-2 text-red-400" />
          <h2 className="text-xl font-semibold">Briefing</h2>
          {testState.dryRunInProgress && (
            <span className="ml-3 px-2 py-1 bg-yellow-900/30 text-yellow-400 text-xs rounded-full flex items-center gap-1">
              <TestTube className="w-3 h-3" />
              TEST MODE
            </span>
          )}
        </div>
        {briefingCheckResult && (
          <span
            title={briefingCheckResult.justification}
            className={`px-2 py-1 text-xs rounded-full flex items-center gap-1 ${
              briefingCheckResult.verdict === 'NO'
                ? 'bg-green-900/30 text-green-400'
                : briefingCheckResult.verdict === 'MAYBE'
                  ? 'bg-yellow-900/30 text-yellow-400'
                  : 'bg-red-900/30 text-red-400'
            }`}
          >
            Hallucination check: {briefingCheckResult.verdict}
            {briefingCheckResult.retried && ' (after retry)'}
          </span>
        )}
      </div>
      <p className="text-sm text-gray-400 mb-4">
        Weave the top-ranked papers from this run into a structured reading view — executive
        summary, themes, and per-paper pitches — grounded in your profile. Runs on the briefing
        model configured above.
      </p>
      <button
        type="button"
        onClick={onGenerate}
        disabled={synthesizing || processing.isRunning}
        className={`px-6 py-3 rounded-lg font-medium transition-all flex items-center gap-2 ${
          synthesizing || processing.isRunning
            ? 'bg-slate-700 text-slate-400 cursor-not-allowed'
            : 'bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 text-white'
        }`}
      >
        {synthesizing ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            {briefingStage === 'checking'
              ? 'Auditing briefing…'
              : briefingStage === 'retrying'
                ? 'Retrying…'
                : 'Generating…'}
          </>
        ) : (
          <>
            <Newspaper className="w-4 h-4" />
            Generate Briefing
          </>
        )}
      </button>
      {synthesisError && <p className="mt-2 text-sm text-red-400">Error: {synthesisError}</p>}
      {briefingCheckResult &&
        briefingCheckResult.verdict !== 'NO' &&
        briefingCheckResult.flaggedClaims?.length > 0 && (
          <details className="mt-3 text-xs text-yellow-300">
            <summary className="cursor-pointer hover:text-yellow-200">
              {briefingCheckResult.flaggedClaims.length} flagged claim
              {briefingCheckResult.flaggedClaims.length === 1 ? '' : 's'} · click to view
            </summary>
            <ul className="mt-2 space-y-2 pl-4">
              {briefingCheckResult.flaggedClaims.map((claim, i) => (
                <li key={i} className="list-disc">
                  <div className="italic">&quot;{claim.excerpt}&quot;</div>
                  {claim.paperArxivId && (
                    <div className="text-slate-500">re: {claim.paperArxivId}</div>
                  )}
                  <div className="text-slate-400">{claim.concern}</div>
                </li>
              ))}
            </ul>
          </details>
        )}
    </div>
  );
}
