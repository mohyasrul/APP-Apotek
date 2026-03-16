import { describe, it, expect } from 'vitest';
import { cn } from '../lib/cn';

describe('cn()', () => {
  it('returns empty string for no arguments', () => {
    expect(cn()).toBe('');
  });

  it('returns a single class string', () => {
    expect(cn('foo')).toBe('foo');
  });

  it('joins multiple class strings', () => {
    expect(cn('foo', 'bar', 'baz')).toBe('foo bar baz');
  });

  it('ignores falsy values (undefined, null, false)', () => {
    expect(cn('foo', undefined, null, false, 'bar')).toBe('foo bar');
  });

  it('handles conditional clsx-style objects', () => {
    expect(cn({ 'active': true, 'disabled': false })).toBe('active');
  });

  it('merges Tailwind conflicting classes — last wins', () => {
    // tailwind-merge resolves conflicts: p-4 overrides p-2
    expect(cn('p-2', 'p-4')).toBe('p-4');
  });

  it('merges conflicting text colors', () => {
    expect(cn('text-red-500', 'text-blue-600')).toBe('text-blue-600');
  });

  it('merges conflicting bg colors', () => {
    expect(cn('bg-gray-100', 'bg-indigo-600')).toBe('bg-indigo-600');
  });

  it('keeps non-conflicting classes', () => {
    const result = cn('flex', 'items-center', 'text-sm', 'font-semibold');
    expect(result).toContain('flex');
    expect(result).toContain('items-center');
    expect(result).toContain('text-sm');
    expect(result).toContain('font-semibold');
  });

  it('handles arrays of classes', () => {
    expect(cn(['foo', 'bar'])).toBe('foo bar');
  });

  it('handles mixed conditions and strings', () => {
    const active = true;
    const disabled = false;
    const result = cn('btn', { 'btn-active': active, 'btn-disabled': disabled }, 'extra');
    expect(result).toBe('btn btn-active extra');
  });
});
