import { History } from 'lucide-react';
import PropTypes from 'prop-types';

// Muted informational badge — NOT a status indicator. Per CLAUDE.md styling
// rules, status colors (#22c55e/#f59e0b/#ef4444) are reserved for verdicts;
// "seen before" is neither success nor failure, so it uses muted tokens.
export default function DuplicateBadge({ isDuplicate, firstSeenDate }) {
  if (!isDuplicate) return null;
  return (
    <span
      title={firstSeenDate ? `Seen in a run on ${firstSeenDate}` : 'Seen in a past run'}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        padding: '2px 6px',
        fontSize: '11px',
        fontFamily: 'var(--aparture-font-sans)',
        color: 'var(--aparture-mute)',
        border: '1px solid var(--aparture-hairline)',
        borderRadius: '4px',
        whiteSpace: 'nowrap',
      }}
    >
      <History size={11} aria-hidden />
      seen {firstSeenDate ?? 'before'}
    </span>
  );
}

DuplicateBadge.propTypes = {
  isDuplicate: PropTypes.bool,
  firstSeenDate: PropTypes.string,
};
