import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Button from '../../../components/ui/Button.jsx';
import Card from '../../../components/ui/Card.jsx';
import Input from '../../../components/ui/Input.jsx';
import TextArea from '../../../components/ui/TextArea.jsx';
import Select from '../../../components/ui/Select.jsx';
import Checkbox from '../../../components/ui/Checkbox.jsx';

describe('Button', () => {
  it('renders with children', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByRole('button', { name: 'Click me' })).toBeDefined();
  });

  it('renders primary variant', () => {
    render(<Button variant="primary">Save</Button>);
    const btn = screen.getByRole('button', { name: 'Save' });
    expect(btn.style.background).toContain('var(--aparture-accent)');
  });

  it('renders secondary variant by default', () => {
    render(<Button>Default</Button>);
    const btn = screen.getByRole('button', { name: 'Default' });
    expect(btn.style.border).toContain('var(--aparture-hairline)');
  });

  it('renders ghost variant', () => {
    render(<Button variant="ghost">Ghost</Button>);
    const btn = screen.getByRole('button', { name: 'Ghost' });
    expect(btn.style.color).toContain('var(--aparture-mute)');
    expect(btn.style.borderStyle).toBe('none');
  });

  it('applies disabled state', () => {
    render(<Button disabled>Disabled</Button>);
    const btn = screen.getByRole('button', { name: 'Disabled' });
    expect(btn.disabled).toBe(true);
    expect(btn.style.opacity).toBe('0.5');
  });

  it('calls onClick when clicked', async () => {
    const user = userEvent.setup();
    let clicked = false;
    render(
      <Button
        onClick={() => {
          clicked = true;
        }}
      >
        Go
      </Button>
    );
    await user.click(screen.getByRole('button', { name: 'Go' }));
    expect(clicked).toBe(true);
  });

  it('defaults to type="button"', () => {
    render(<Button>Test</Button>);
    expect(screen.getByRole('button', { name: 'Test' }).type).toBe('button');
  });

  it('spreads extra props', () => {
    render(<Button data-testid="btn">Extra</Button>);
    expect(screen.getByTestId('btn')).toBeDefined();
  });
});

describe('Card', () => {
  it('renders children', () => {
    render(
      <Card>
        <p>Content</p>
      </Card>
    );
    expect(screen.getByText('Content')).toBeDefined();
  });

  it('merges className', () => {
    const { container } = render(<Card className="custom">Content</Card>);
    expect(container.firstChild.className).toContain('custom');
  });

  it('applies surface background', () => {
    const { container } = render(<Card>Styled</Card>);
    expect(container.firstChild.style.background).toContain('var(--aparture-surface)');
  });

  it('spreads extra props', () => {
    render(<Card data-testid="card">Spread</Card>);
    expect(screen.getByTestId('card')).toBeDefined();
  });
});

describe('Input', () => {
  it('renders an input element', () => {
    render(<Input placeholder="Type here" />);
    expect(screen.getByPlaceholderText('Type here')).toBeDefined();
  });

  it('forwards value and onChange', async () => {
    const user = userEvent.setup();
    let value = '';
    render(
      <Input
        value={value}
        onChange={(e) => {
          value = e.target.value;
        }}
      />
    );
    const input = screen.getByRole('textbox');
    await user.type(input, 'hello');
    expect(value).toBeTruthy();
  });

  it('applies border-box sizing', () => {
    render(<Input placeholder="box" />);
    expect(screen.getByPlaceholderText('box').style.boxSizing).toBe('border-box');
  });

  it('merges className', () => {
    render(<Input className="custom" placeholder="cls" />);
    expect(screen.getByPlaceholderText('cls').className).toContain('custom');
  });
});

describe('TextArea', () => {
  it('renders a textarea element', () => {
    render(<TextArea placeholder="Write here" />);
    expect(screen.getByPlaceholderText('Write here')).toBeDefined();
  });

  it('sets vertical resize and min-height', () => {
    render(<TextArea placeholder="resize" />);
    const ta = screen.getByPlaceholderText('resize');
    expect(ta.style.resize).toBe('vertical');
    expect(ta.style.minHeight).toBe('120px');
  });

  it('merges className', () => {
    render(<TextArea className="custom" placeholder="cls" />);
    expect(screen.getByPlaceholderText('cls').className).toContain('custom');
  });
});

describe('Select', () => {
  it('renders options', () => {
    render(
      <Select>
        <option value="a">Option A</option>
        <option value="b">Option B</option>
      </Select>
    );
    expect(screen.getByRole('combobox')).toBeDefined();
    expect(screen.getByText('Option A')).toBeDefined();
    expect(screen.getByText('Option B')).toBeDefined();
  });

  it('removes native appearance', () => {
    render(
      <Select>
        <option value="x">X</option>
      </Select>
    );
    const sel = screen.getByRole('combobox');
    expect(sel.style.appearance).toBe('none');
  });

  it('merges className', () => {
    render(
      <Select className="custom">
        <option>Y</option>
      </Select>
    );
    expect(screen.getByRole('combobox').className).toContain('custom');
  });
});

describe('Checkbox', () => {
  it('renders label text', () => {
    render(<Checkbox label="Accept terms" checked={false} onChange={() => {}} />);
    expect(screen.getByText('Accept terms')).toBeDefined();
  });

  it('handles change events', async () => {
    const user = userEvent.setup();
    let checked = false;
    render(
      <Checkbox
        label="Toggle"
        checked={checked}
        onChange={(e) => {
          checked = e.target.checked;
        }}
      />
    );
    await user.click(screen.getByText('Toggle'));
    expect(checked).toBe(true);
  });

  it('renders as disabled', () => {
    render(<Checkbox label="Disabled" checked={false} onChange={() => {}} disabled />);
    expect(screen.getByRole('checkbox').disabled).toBe(true);
  });

  it('renders without label text', () => {
    const { container } = render(<Checkbox checked={false} onChange={() => {}} />);
    expect(container.querySelector('input[type="checkbox"]')).toBeTruthy();
    expect(container.querySelector('span')).toBeFalsy();
  });
});
