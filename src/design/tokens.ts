// Design tokens for MediSir design system

export const spacing = {
  0: '0px',
  0.5: '2px',
  1: '4px',
  1.5: '6px',
  2: '8px',
  2.5: '10px',
  3: '12px',
  4: '16px',
  5: '20px',
  6: '24px',
  8: '32px',
  10: '40px',
  12: '48px',
  16: '64px',
  20: '80px',
} as const;

export const radius = {
  sm: '0.25rem',   // 4px
  md: '0.375rem',  // 6px
  lg: '0.5rem',    // 8px
  xl: '0.75rem',   // 12px
  '2xl': '1rem',   // 16px
  full: '9999px',
} as const;

export const shadow = {
  e1: '0 1px 2px 0 rgb(0 0 0 / 0.04)',
  e2: '0 1px 3px 0 rgb(0 0 0 / 0.06), 0 1px 2px -1px rgb(0 0 0 / 0.06)',
  e3: '0 4px 6px -1px rgb(0 0 0 / 0.07), 0 2px 4px -2px rgb(0 0 0 / 0.05)',
  e4: '0 10px 15px -3px rgb(0 0 0 / 0.08), 0 4px 6px -4px rgb(0 0 0 / 0.04)',
} as const;

export const motion = {
  duration: {
    fast: '100ms',
    normal: '200ms',
    slow: '300ms',
  },
  easing: {
    standard: 'cubic-bezier(0.4, 0, 0.2, 1)',
    decelerate: 'cubic-bezier(0, 0, 0.2, 1)',
    accelerate: 'cubic-bezier(0.4, 0, 1, 1)',
  },
} as const;

export const zIndex = {
  dropdown: 50,
  sticky: 40,
  overlay: 60,
  modal: 70,
  toast: 80,
} as const;

export const typography = {
  display: { size: '2.25rem', lineHeight: '2.5rem', weight: '700', tracking: '-0.025em' },
  h1: { size: '1.875rem', lineHeight: '2.25rem', weight: '700', tracking: '-0.025em' },
  h2: { size: '1.5rem', lineHeight: '2rem', weight: '600', tracking: '-0.025em' },
  h3: { size: '1.25rem', lineHeight: '1.75rem', weight: '600', tracking: '-0.01em' },
  h4: { size: '1.125rem', lineHeight: '1.75rem', weight: '600' },
  h5: { size: '1rem', lineHeight: '1.5rem', weight: '600' },
  h6: { size: '0.875rem', lineHeight: '1.25rem', weight: '600' },
  'body-lg': { size: '1rem', lineHeight: '1.5rem', weight: '400' },
  body: { size: '0.875rem', lineHeight: '1.25rem', weight: '400' },
  'body-sm': { size: '0.75rem', lineHeight: '1rem', weight: '400' },
  caption: { size: '0.6875rem', lineHeight: '1rem', weight: '500' },
} as const;
