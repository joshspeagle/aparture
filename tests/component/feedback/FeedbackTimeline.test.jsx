import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import FeedbackTimeline, {
  filterEvents,
  groupByPaper,
} from '../../../components/feedback/FeedbackTimeline.jsx';

const NOW = 1700000000000; // fixed reference for deterministic date-range tests
const DAY = 86400000;

const makeStar = (id, arxivId, timestamp) => ({
  id,
  type: 'star',
  arxivId,
  paperTitle: `Title ${arxivId}`,
  quickSummary: 's',
  score: 9,
  timestamp,
  briefingDate: '2026-04-10',
});

const makeComment = (id, arxivId, timestamp, text = 'c') => ({
  id,
  type: 'paper-comment',
  arxivId,
  paperTitle: `Title ${arxivId}`,
  quickSummary: 's',
  score: 9,
  text,
  timestamp,
  briefingDate: '2026-04-10',
});

const makeGeneral = (id, timestamp) => ({
  id,
  type: 'general-comment',
  text: `general ${id}`,
  timestamp,
  briefingDate: '2026-04-11',
});

describe('filterEvents', () => {
  const defaultFilters = { type: 'all', newOnly: false, dateRange: 'all' };

  it('returns all events when filters are default', () => {
    const events = [makeStar('s1', 'p1', NOW), makeGeneral('g1', NOW)];
    expect(filterEvents(events, defaultFilters)).toHaveLength(2);
  });

  it('filters by type=stars', () => {
    const events = [makeStar('s1', 'p1', NOW), makeGeneral('g1', NOW)];
    const result = filterEvents(events, { ...defaultFilters, type: 'stars' });
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('star');
  });

  it('filters by type=comments (both paper and general)', () => {
    const events = [
      makeStar('s1', 'p1', NOW),
      makeComment('c1', 'p1', NOW),
      makeGeneral('g1', NOW),
    ];
    const result = filterEvents(events, { ...defaultFilters, type: 'comments' });
    expect(result).toHaveLength(2);
  });

  it('filters by newOnly=true using cutoff', () => {
    const events = [makeStar('s1', 'p1', NOW - 10000), makeStar('s2', 'p2', NOW + 10000)];
    const result = filterEvents(events, { ...defaultFilters, newOnly: true }, { cutoff: NOW });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('s2');
  });

  it('filters by dateRange=7d', () => {
    const events = [
      makeStar('s1', 'p1', NOW - 3 * DAY), // within 7d
      makeStar('s2', 'p2', NOW - 10 * DAY), // outside 7d
    ];
    const result = filterEvents(events, { ...defaultFilters, dateRange: '7d' }, { now: NOW });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('s1');
  });
});

describe('groupByPaper', () => {
  it('groups star + comment on the same paper into one group', () => {
    const events = [
      makeStar('s1', '2504.01234', NOW),
      makeComment('c1', '2504.01234', NOW + 100, 'thought'),
    ];
    const groups = groupByPaper(events);
    expect(groups).toHaveLength(1);
    expect(groups[0].events).toHaveLength(2);
    expect(groups[0].newestTs).toBe(NOW + 100);
  });

  it('keeps general comments as separate groups', () => {
    const events = [makeGeneral('g1', NOW), makeGeneral('g2', NOW + 100)];
    const groups = groupByPaper(events);
    expect(groups).toHaveLength(2);
  });

  it('sorts groups by newestTs desc', () => {
    const events = [
      makeStar('s1', 'pA', NOW), // older
      makeStar('s2', 'pB', NOW + 1000), // newer
    ];
    const groups = groupByPaper(events);
    expect(groups[0].events[0].arxivId).toBe('pB');
    expect(groups[1].events[0].arxivId).toBe('pA');
  });

  it('groups paper-comments under the same arxivId as a star', () => {
    const events = [
      makeStar('s1', 'pA', NOW),
      makeComment('c1', 'pA', NOW + 1, 'a'),
      makeComment('c2', 'pA', NOW + 2, 'b'),
      makeStar('s2', 'pB', NOW + 3),
    ];
    const groups = groupByPaper(events);
    // Expect 2 groups: pA (3 events), pB (1 event)
    expect(groups).toHaveLength(2);
    const pAGroup = groups.find((g) => g.key === 'paper-pA');
    expect(pAGroup.events).toHaveLength(3);
  });
});

describe('FeedbackTimeline', () => {
  const defaultFilters = { type: 'all', newOnly: false, dateRange: 'all' };

  it('renders nothing when events is empty', () => {
    const { container } = render(
      <FeedbackTimeline events={[]} filters={defaultFilters} cutoff={0} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders all events with no divider when cutoff is 0', () => {
    const events = [makeStar('s1', 'p1', NOW), makeStar('s2', 'p2', NOW + 1000)];
    const { container } = render(
      <FeedbackTimeline events={events} filters={defaultFilters} cutoff={0} />
    );
    expect(container.querySelector('.border-dashed')).toBeNull();
    // Two star feedback items rendered
    expect(container.querySelectorAll('.border-l-yellow-500')).toHaveLength(2);
  });

  it('renders a dashed divider when cutoff splits the events', () => {
    const events = [makeStar('s-old', 'pA', NOW - 1000), makeStar('s-new', 'pB', NOW + 1000)];
    const { container } = render(
      <FeedbackTimeline events={events} filters={defaultFilters} cutoff={NOW} />
    );
    expect(container.querySelector('.border-dashed')).not.toBeNull();
    expect(screen.getByText(/new since last revision/i)).toBeInTheDocument();
    expect(screen.getByText(/already incorporated/i)).toBeInTheDocument();
  });

  it('applies type filter to the rendered events', () => {
    const events = [makeStar('s1', 'p1', NOW), makeGeneral('g1', NOW)];
    const { container } = render(
      <FeedbackTimeline events={events} filters={{ ...defaultFilters, type: 'stars' }} cutoff={0} />
    );
    expect(container.querySelectorAll('.border-l-yellow-500')).toHaveLength(1);
    expect(container.querySelectorAll('.border-l-blue-500')).toHaveLength(0);
  });
});
