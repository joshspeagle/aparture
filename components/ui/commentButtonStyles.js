// Token-based comment-button styles shared by the inline row-comment UIs
// (FilterResultsList, ScoreReviewSurface) and RankedPaperCard's comment
// editor: ghost cancel, accent save. Lived in FilterResultsList originally;
// moved here so a filter component isn't the style source for the other
// surfaces.

export const COMMENT_CANCEL_BUTTON_STYLE = {
  fontFamily: 'var(--aparture-font-sans)',
  fontSize: 'var(--aparture-text-xs)',
  padding: '2px 8px',
  borderRadius: '4px',
  border: '1px solid var(--aparture-hairline)',
  background: 'transparent',
  color: 'var(--aparture-mute)',
  cursor: 'pointer',
  transition: 'all 150ms ease',
};

export const COMMENT_SAVE_BUTTON_STYLE = {
  fontFamily: 'var(--aparture-font-sans)',
  fontSize: 'var(--aparture-text-xs)',
  padding: '2px 8px',
  borderRadius: '4px',
  border: '1px solid var(--aparture-accent)',
  background: 'var(--aparture-accent)',
  color: '#fff',
  fontWeight: 500,
  cursor: 'pointer',
  transition: 'all 150ms ease',
};
