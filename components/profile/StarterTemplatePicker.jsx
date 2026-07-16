// components/profile/StarterTemplatePicker.jsx
// First-run starter-template picker, shown at the top of the Profile view
// only while the profile is still the untouched shipped template (no saved
// edits, no dismissal). Choosing a template sets both the profile content and
// config.selectedCategories, then dismisses the picker permanently.

import { useState } from 'react';
import Button from '../ui/Button.jsx';
import Card from '../ui/Card.jsx';
import { STARTER_TEMPLATES, isUneditedProfile } from '../../lib/profile/starterTemplates.js';

export const TEMPLATE_PICKER_DISMISSED_KEY = 'aparture-template-picker-dismissed';

function readDismissed() {
  if (typeof window === 'undefined') return true;
  return window.localStorage.getItem(TEMPLATE_PICKER_DISMISSED_KEY) === 'true';
}

export default function StarterTemplatePicker({
  profile,
  updateProfile,
  setConfig,
  disabled = false,
}) {
  const [dismissed, setDismissed] = useState(readDismissed);

  if (dismissed || !isUneditedProfile(profile)) return null;

  const dismiss = () => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(TEMPLATE_PICKER_DISMISSED_KEY, 'true');
    }
    setDismissed(true);
  };

  const applyTemplate = (template) => {
    updateProfile(template.profileText);
    setConfig?.((prev) => ({ ...prev, selectedCategories: [...template.categories] }));
    dismiss();
  };

  const startFromScratch = () => {
    updateProfile('');
    dismiss();
  };

  return (
    <section
      aria-label="Starter templates"
      style={{
        background: 'var(--aparture-surface)',
        border: '1px solid var(--aparture-hairline)',
        borderRadius: '8px',
        padding: 'var(--aparture-space-6)',
        marginBottom: 'var(--aparture-space-6)',
      }}
    >
      <h2
        style={{
          fontFamily: 'var(--aparture-font-sans)',
          fontSize: 'var(--aparture-text-base)',
          fontWeight: 600,
          color: 'var(--aparture-ink)',
          margin: 0,
          marginBottom: 'var(--aparture-space-2)',
        }}
      >
        Start from a template
      </h2>
      <p
        style={{
          fontFamily: 'var(--aparture-font-sans)',
          fontSize: 'var(--aparture-text-sm)',
          lineHeight: 1.6,
          color: 'var(--aparture-mute)',
          margin: 0,
          marginBottom: 'var(--aparture-space-4)',
        }}
      >
        These are examples, not defaults. Pick the one closest to your field, then replace the text
        with your own research once you&#8217;ve seen a run work. Choosing a template also sets your
        arXiv categories.
      </p>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: 'var(--aparture-space-3)',
        }}
      >
        {STARTER_TEMPLATES.map((template, i) => (
          <Card
            key={template.id}
            style={{
              padding: 'var(--aparture-space-4)',
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--aparture-space-2)',
              // Featured card (first entry) gets an accent border.
              border:
                i === 0 ? '1px solid var(--aparture-accent)' : '1px solid var(--aparture-hairline)',
            }}
          >
            <div
              style={{
                fontFamily: 'var(--aparture-font-sans)',
                fontSize: 'var(--aparture-text-sm)',
                fontWeight: 600,
                color: 'var(--aparture-ink)',
              }}
            >
              {template.name}
            </div>
            <p
              style={{
                fontFamily: 'var(--aparture-font-sans)',
                fontSize: 'var(--aparture-text-xs)',
                lineHeight: 1.5,
                color: 'var(--aparture-mute)',
                margin: 0,
                flex: 1,
              }}
            >
              {template.description}
            </p>
            <div
              style={{
                fontFamily: 'var(--aparture-font-sans)',
                fontSize: 'var(--aparture-text-xs)',
                color: 'var(--aparture-mute)',
              }}
            >
              {template.categories.length}{' '}
              {template.categories.length === 1 ? 'category' : 'categories'}
            </div>
            <Button
              variant="secondary"
              disabled={disabled}
              onClick={() => applyTemplate(template)}
              style={{ alignSelf: 'flex-start' }}
            >
              Use this template
            </Button>
          </Card>
        ))}
      </div>

      <div
        style={{
          marginTop: 'var(--aparture-space-4)',
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--aparture-space-4)',
        }}
      >
        <Button variant="ghost" disabled={disabled} onClick={startFromScratch}>
          Start from scratch
        </Button>
        <button
          type="button"
          onClick={dismiss}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--aparture-mute)',
            fontFamily: 'var(--aparture-font-sans)',
            fontSize: 'var(--aparture-text-xs)',
            textDecoration: 'underline',
            cursor: 'pointer',
            padding: 0,
          }}
        >
          Don&#8217;t show this again
        </button>
      </div>
    </section>
  );
}
