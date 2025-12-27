/**
 * Toggle Component Tests
 * 
 * Ensures RTL/LTR positioning works correctly and prevents regressions.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Toggle } from './Toggle';

describe('Toggle Component', () => {
  it('renders with label', () => {
    const onChange = vi.fn();
    render(<Toggle checked={false} onChange={onChange} label="Test Toggle" />);
    
    expect(screen.getByText('Test Toggle')).toBeInTheDocument();
  });

  it('calls onChange when clicked', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Toggle checked={false} onChange={onChange} label="Test Toggle" />);
    
    const toggle = screen.getByRole('switch');
    await user.click(toggle);
    
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('respects disabled state', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Toggle checked={false} onChange={onChange} label="Test Toggle" disabled />);
    
    const toggle = screen.getByRole('switch');
    await user.click(toggle);
    
    expect(onChange).not.toHaveBeenCalled();
  });

  it('applies correct size classes for md size', () => {
    const onChange = vi.fn();
    const { container } = render(
      <Toggle checked={false} onChange={onChange} label="Test Toggle" size="md" />
    );
    
    const button = container.querySelector('button');
    expect(button).toHaveClass('w-14', 'h-8');
  });

  it('applies correct translate classes for unchecked state (LTR)', () => {
    const onChange = vi.fn();
    const { container } = render(
      <Toggle checked={false} onChange={onChange} label="Test Toggle" size="md" />
    );
    
    const thumb = container.querySelector('span:not(.sr-only)');
    
    // Should have LTR offset: translate-x-[0.25rem]
    expect(thumb?.className).toContain('translate-x-[0.25rem]');
    
    // Should have RTL offset: rtl:translate-x-[-0.2rem]
    expect(thumb?.className).toContain('rtl:translate-x-[-0.2rem]');
  });

  it('applies correct translate classes for checked state', () => {
    const onChange = vi.fn();
    const { container } = render(
      <Toggle checked={true} onChange={onChange} label="Test Toggle" size="md" />
    );
    
    const thumb = container.querySelector('span:not(.sr-only)');
    
    // Should have checked offset: translate-x-6
    expect(thumb?.className).toContain('translate-x-6');
  });

  it('renders with helper text', () => {
    const onChange = vi.fn();
    render(
      <Toggle
        checked={false}
        onChange={onChange}
        label="Test Toggle"
        helperText="This is helper text"
      />
    );
    
    expect(screen.getByText('This is helper text')).toBeInTheDocument();
  });

  it('applies correct aria attributes', () => {
    const onChange = vi.fn();
    render(<Toggle checked={true} onChange={onChange} label="Test Toggle" />);
    
    const toggle = screen.getByRole('switch');
    expect(toggle).toHaveAttribute('aria-checked', 'true');
  });

  describe('RTL Support', () => {
    it('small size has correct RTL offsets', () => {
      const onChange = vi.fn();
      const { container } = render(
        <Toggle checked={false} onChange={onChange} label="Test Toggle" size="sm" />
      );
      
      const thumb = container.querySelector('span:not(.sr-only)');
      
      // LTR: 0.125rem, RTL: -0.1rem
      expect(thumb?.className).toContain('translate-x-[0.125rem]');
      expect(thumb?.className).toContain('rtl:translate-x-[-0.1rem]');
    });

    it('medium size has correct RTL offsets', () => {
      const onChange = vi.fn();
      const { container } = render(
        <Toggle checked={false} onChange={onChange} label="Test Toggle" size="md" />
      );
      
      const thumb = container.querySelector('span:not(.sr-only)');
      
      // LTR: 0.25rem, RTL: -0.2rem (fixes the reported bug)
      expect(thumb?.className).toContain('translate-x-[0.25rem]');
      expect(thumb?.className).toContain('rtl:translate-x-[-0.2rem]');
    });

    it('large size has correct RTL offsets', () => {
      const onChange = vi.fn();
      const { container } = render(
        <Toggle checked={false} onChange={onChange} label="Test Toggle" size="lg" />
      );
      
      const thumb = container.querySelector('span:not(.sr-only)');
      
      // LTR: 0.25rem, RTL: -0.2rem
      expect(thumb?.className).toContain('translate-x-[0.25rem]');
      expect(thumb?.className).toContain('rtl:translate-x-[-0.2rem]');
    });
  });
});

