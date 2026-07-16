// components/profile/ProfileSwitcher.jsx
// Compact named-profile control rendered inside YourProfile: shows the
// active profile name with switch / save-as / rename / delete actions.
// Named profiles are snapshots of the working slot (see hooks/useProfile.js);
// the active profile is what every pipeline stage reads.

import { useState } from 'react';
import Button from '../ui/Button.jsx';
import Input from '../ui/Input.jsx';
import Select from '../ui/Select.jsx';

export default function ProfileSwitcher({
  profiles = {},
  activeProfileName = 'Default',
  saveAs,
  switchTo,
  deleteProfile,
  renameProfile,
  disabled = false,
}) {
  // mode: null | 'save-as' | 'rename'
  const [mode, setMode] = useState(null);
  const [nameInput, setNameInput] = useState('');
  const [inputError, setInputError] = useState('');

  const names = Object.keys(profiles);

  const openInput = (nextMode) => {
    setMode(nextMode);
    setNameInput(nextMode === 'rename' ? activeProfileName : '');
    setInputError('');
  };

  const confirmInput = () => {
    const name = nameInput.trim();
    if (!name) return;
    // Mirror the hook's clobber guards (saveAs / renameProfile silently
    // refuse to overwrite a different existing snapshot) so the refusal is
    // visible instead of looking like a save that didn't take.
    if (profiles[name] && name !== activeProfileName) {
      setInputError(`A profile named "${name}" already exists.`);
      return;
    }
    if (mode === 'save-as') saveAs?.(name);
    if (mode === 'rename') renameProfile?.(activeProfileName, name);
    setMode(null);
    setNameInput('');
    setInputError('');
  };

  const cancelInput = () => {
    setMode(null);
    setNameInput('');
    setInputError('');
  };

  const smallButtonStyle = {
    fontSize: 'var(--aparture-text-xs)',
    padding: '4px 8px',
  };

  return (
    <div style={{ marginBottom: 'var(--aparture-space-4)' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--aparture-space-2)',
          flexWrap: 'wrap',
        }}
      >
        <span
          style={{
            fontFamily: 'var(--aparture-font-sans)',
            fontSize: 'var(--aparture-text-xs)',
            fontWeight: 600,
            color: 'var(--aparture-mute)',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}
        >
          Profile
        </span>
        <Select
          aria-label="Active profile"
          value={activeProfileName}
          onChange={(e) => switchTo?.(e.target.value)}
          disabled={disabled}
          style={{ width: 'auto', minWidth: '160px', padding: '4px 8px', paddingRight: '32px' }}
        >
          {names.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </Select>
        <Button
          variant="secondary"
          style={smallButtonStyle}
          disabled={disabled}
          onClick={() => openInput('save-as')}
        >
          Save as…
        </Button>
        <Button
          variant="secondary"
          style={smallButtonStyle}
          disabled={disabled}
          onClick={() => openInput('rename')}
        >
          Rename
        </Button>
        <Button
          variant="secondary"
          style={smallButtonStyle}
          disabled={disabled || names.length <= 1}
          onClick={() => deleteProfile?.(activeProfileName)}
        >
          Delete
        </Button>
      </div>

      {mode && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--aparture-space-2)',
            marginTop: 'var(--aparture-space-2)',
          }}
        >
          <Input
            aria-label={mode === 'save-as' ? 'New profile name' : 'Rename profile'}
            value={nameInput}
            onChange={(e) => {
              setNameInput(e.target.value);
              if (inputError) setInputError('');
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') confirmInput();
              if (e.key === 'Escape') cancelInput();
            }}
            placeholder="Profile name"
            style={{ width: '220px', padding: '4px 8px' }}
          />
          <Button variant="primary" style={smallButtonStyle} onClick={confirmInput}>
            {mode === 'save-as' ? 'Save' : 'Rename'}
          </Button>
          <Button variant="secondary" style={smallButtonStyle} onClick={cancelInput}>
            Cancel
          </Button>
        </div>
      )}

      {inputError && (
        <p
          role="alert"
          style={{
            fontFamily: 'var(--aparture-font-sans)',
            fontSize: 'var(--aparture-text-xs)',
            color: '#ef4444',
            margin: 0,
            marginTop: 'var(--aparture-space-1)',
          }}
        >
          {inputError}
        </p>
      )}

      <p
        style={{
          fontFamily: 'var(--aparture-font-sans)',
          fontSize: 'var(--aparture-text-xs)',
          color: 'var(--aparture-mute)',
          margin: 0,
          marginTop: 'var(--aparture-space-2)',
        }}
      >
        The active profile is what every run reads.
      </p>
    </div>
  );
}
