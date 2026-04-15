const TYPE_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'stars', label: '★ Stars' },
  { value: 'dismisses', label: '⊘ Dismisses' },
  { value: 'comments', label: '💬 Comments' },
  { value: 'overrides', label: '⇄ Overrides' },
];

const DATE_OPTIONS = [
  { value: 'all', label: 'All time' },
  { value: '7d', label: 'Past 7 days' },
  { value: '14d', label: 'Past 14 days' },
  { value: '30d', label: 'Past 30 days' },
];

export default function FeedbackFilters({ filters, onFiltersChange }) {
  const handleType = (type) => {
    onFiltersChange({ ...filters, type });
  };
  const handleNewOnly = () => {
    onFiltersChange({ ...filters, newOnly: !filters.newOnly });
  };
  const handleDateRange = (e) => {
    onFiltersChange({ ...filters, dateRange: e.target.value });
  };

  return (
    <div className="flex flex-wrap items-center gap-4 text-xs text-slate-300">
      <div className="inline-flex rounded-md border border-slate-700 overflow-hidden">
        {TYPE_OPTIONS.map((opt) => {
          const active = filters.type === opt.value;
          const classes = active
            ? 'bg-slate-700 text-slate-100'
            : 'text-slate-400 hover:text-slate-200';
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => handleType(opt.value)}
              className={`px-3 py-1 ${classes}`}
            >
              {opt.label}
            </button>
          );
        })}
      </div>

      <label className="inline-flex items-center gap-2 cursor-pointer">
        <input type="checkbox" checked={filters.newOnly} onChange={handleNewOnly} />
        <span>New since last revision</span>
      </label>

      <select
        value={filters.dateRange}
        onChange={handleDateRange}
        className="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-slate-200"
      >
        {DATE_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}
