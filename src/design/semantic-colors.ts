/**
 * Semantic color tokens for MediSir design system.
 * These map to CSS custom properties defined in index.css.
 * Usage: className="bg-[var(--color-surface)]" or use the tailwind semantic classes.
 */

export const semanticColors = {
  // Canvas / Background
  canvas: 'var(--color-canvas)',
  surface: 'var(--color-surface)',
  elevated: 'var(--color-elevated)',
  muted: 'var(--color-muted)',

  // Text
  textPrimary: 'var(--color-text-primary)',
  textSecondary: 'var(--color-text-secondary)',
  textMuted: 'var(--color-text-muted)',
  textInverse: 'var(--color-text-inverse)',

  // Border
  borderSubtle: 'var(--color-border-subtle)',
  borderDefault: 'var(--color-border-default)',
  borderStrong: 'var(--color-border-strong)',

  // Brand
  brandPrimary: 'var(--color-brand-primary)',
  brandHover: 'var(--color-brand-hover)',
  brandActive: 'var(--color-brand-active)',

  // Status
  successBg: 'var(--color-success-bg)',
  successText: 'var(--color-success-text)',
  successBorder: 'var(--color-success-border)',

  warningBg: 'var(--color-warning-bg)',
  warningText: 'var(--color-warning-text)',
  warningBorder: 'var(--color-warning-border)',

  errorBg: 'var(--color-error-bg)',
  errorText: 'var(--color-error-text)',
  errorBorder: 'var(--color-error-border)',

  infoBg: 'var(--color-info-bg)',
  infoText: 'var(--color-info-text)',
  infoBorder: 'var(--color-info-border)',
} as const;

export type SemanticColor = keyof typeof semanticColors;
