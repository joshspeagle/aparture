import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ScopedCommentInput from '../../../components/feedback/ScopedCommentInput.jsx';

describe('ScopedCommentInput', () => {
  it('renders collapsed by default with trigger label', () => {
    render(
      <ScopedCommentInput
        scope={{ kind: 'bucket', bucket: 'YES' }}
        triggerLabel="+ feedback on this bucket"
        placeholder="ex"
        onSave={() => {}}
      />
    );
    expect(screen.getByText('+ feedback on this bucket')).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('clicking trigger expands the textarea with placeholder', () => {
    render(
      <ScopedCommentInput
        scope={{ kind: 'bucket', bucket: 'YES' }}
        triggerLabel="+ trigger"
        placeholder="e.g., write something useful"
        onSave={() => {}}
      />
    );
    fireEvent.click(screen.getByText('+ trigger'));
    const textarea = screen.getByRole('textbox');
    expect(textarea).toBeInTheDocument();
    expect(textarea.placeholder).toBe('e.g., write something useful');
  });

  it('save calls onSave with trimmed text', () => {
    const onSave = vi.fn();
    render(
      <ScopedCommentInput
        scope={{ kind: 'run' }}
        triggerLabel="+ trigger"
        placeholder="ex"
        onSave={onSave}
      />
    );
    fireEvent.click(screen.getByText('+ trigger'));
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '  hello  ' } });
    fireEvent.click(screen.getByText('save'));
    expect(onSave).toHaveBeenCalledWith({ scope: { kind: 'run' }, text: 'hello' });
  });

  it('empty save is a no-op', () => {
    const onSave = vi.fn();
    render(
      <ScopedCommentInput
        scope={{ kind: 'run' }}
        triggerLabel="+ trigger"
        placeholder="ex"
        onSave={onSave}
      />
    );
    fireEvent.click(screen.getByText('+ trigger'));
    fireEvent.click(screen.getByText('save'));
    expect(onSave).not.toHaveBeenCalled();
  });

  it('cancel collapses without calling onSave', () => {
    const onSave = vi.fn();
    render(
      <ScopedCommentInput
        scope={{ kind: 'run' }}
        triggerLabel="+ trigger"
        placeholder="ex"
        onSave={onSave}
      />
    );
    fireEvent.click(screen.getByText('+ trigger'));
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'unsaved' } });
    fireEvent.click(screen.getByText('cancel'));
    expect(onSave).not.toHaveBeenCalled();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('savedText prop pre-fills textarea and changes trigger label', () => {
    render(
      <ScopedCommentInput
        scope={{ kind: 'run' }}
        triggerLabel="+ trigger"
        placeholder="ex"
        savedText="previously saved note"
        onSave={() => {}}
      />
    );
    expect(screen.getByText(/feedback saved/i)).toBeInTheDocument();
    expect(screen.getByText(/previously saved note/)).toBeInTheDocument();
  });

  it('syncs internal text to updated savedText prop when collapsed', () => {
    const { rerender } = render(
      <ScopedCommentInput
        scope={{ kind: 'run' }}
        triggerLabel="+ t"
        placeholder="ex"
        savedText="first"
        onSave={() => {}}
      />
    );
    expect(screen.getByText(/first/)).toBeInTheDocument();
    rerender(
      <ScopedCommentInput
        scope={{ kind: 'run' }}
        triggerLabel="+ t"
        placeholder="ex"
        savedText="updated"
        onSave={() => {}}
      />
    );
    expect(screen.getByText(/updated/)).toBeInTheDocument();
  });
});
