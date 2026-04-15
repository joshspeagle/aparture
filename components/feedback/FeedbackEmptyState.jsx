export default function FeedbackEmptyState() {
  return (
    <div className="rounded-md border border-dashed border-slate-700 bg-slate-900/30 px-5 py-8 text-center">
      <div className="text-slate-400 text-sm mb-2">
        Your feedback will appear here as you interact with briefings.
      </div>
      <div className="text-slate-500 text-xs leading-relaxed max-w-md mx-auto">
        Click <span className="text-yellow-400">★</span> or{' '}
        <span className="text-slate-400">⊘</span> on papers to record your reactions. Add comments
        to specific papers, or use <em>Add a comment</em> above for general thoughts. Your feedback
        powers the <em>Suggest improvements</em> flow in Your Profile.
      </div>
    </div>
  );
}
