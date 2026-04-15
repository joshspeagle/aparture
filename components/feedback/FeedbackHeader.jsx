export default function FeedbackHeader({ newCount, totalCount, onSuggestClick }) {
  const hasNew = newCount > 0;
  return (
    <header className="flex items-center justify-between mb-4">
      <div>
        <h2 className="text-base font-semibold text-slate-100">Feedback</h2>
        <p className="text-xs text-slate-500 mt-0.5">
          {newCount} new since last revision · {totalCount} total
        </p>
      </div>
      <button
        type="button"
        onClick={onSuggestClick}
        disabled={!hasNew}
        className="bg-red-600 hover:bg-red-500 text-white px-4 py-2 rounded-md text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Suggest improvements
      </button>
    </header>
  );
}
