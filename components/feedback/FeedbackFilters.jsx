import Select from '../ui/Select.jsx';

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
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: 'var(--aparture-space-4)',
        fontSize: 'var(--aparture-text-xs)',
        color: 'var(--aparture-ink)',
      }}
    >
      <div
        style={{
          display: 'inline-flex',
          borderRadius: '4px',
          border: '1px solid var(--aparture-hairline)',
          overflow: 'hidden',
        }}
      >
        {TYPE_OPTIONS.map((opt) => {
          const active = filters.type === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => handleType(opt.value)}
              data-active={active || undefined}
              style={{
                padding: '4px 12px',
                background: active ? 'var(--aparture-hover)' : 'transparent',
                color: active ? 'var(--aparture-ink)' : 'var(--aparture-mute)',
                border: 'none',
                cursor: 'pointer',
                fontFamily: 'var(--aparture-font-sans)',
                fontSize: 'inherit',
              }}
            >
              {opt.label}
            </button>
          );
        })}
      </div>

      <label
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 'var(--aparture-space-2)',
          cursor: 'pointer',
          color: 'var(--aparture-ink)',
        }}
      >
        <input type="checkbox" checked={filters.newOnly} onChange={handleNewOnly} />
        <span>New since last revision</span>
      </label>

      <Select value={filters.dateRange} onChange={handleDateRange} style={{ width: 'auto' }}>
        {DATE_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </Select>
    </div>
  );
}
