/**
 * Responsive breakpoint utilities
 * Based on common mobile-first design patterns
 */

export const breakpoints = {
  xs: 0,
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  '2xl': 1536,
} as const;

export type Breakpoint = keyof typeof breakpoints;

/**
 * Media query helper for use in CSS-in-JS or inline styles
 */
export const mediaQuery = {
  xs: `(min-width: ${breakpoints.xs}px)`,
  sm: `(min-width: ${breakpoints.sm}px)`,
  md: `(min-width: ${breakpoints.md}px)`,
  lg: `(min-width: ${breakpoints.lg}px)`,
  xl: `(min-width: ${breakpoints.xl}px)`,
  '2xl': `(min-width: ${breakpoints['2xl']}px)`,
} as const;

/**
 * Max-width media queries
 */
export const maxMediaQuery = {
  xs: `(max-width: ${breakpoints.sm - 1}px)`,
  sm: `(max-width: ${breakpoints.md - 1}px)`,
  md: `(max-width: ${breakpoints.lg - 1}px)`,
  lg: `(max-width: ${breakpoints.xl - 1}px)`,
  xl: `(max-width: ${breakpoints['2xl'] - 1}px)`,
} as const;

/**
 * Check if current viewport matches a breakpoint
 */
export const isBreakpoint = (breakpoint: Breakpoint): boolean => {
  if (typeof window === 'undefined') return false;
  return window.innerWidth >= breakpoints[breakpoint];
};

/**
 * Get current breakpoint name
 */
export const getCurrentBreakpoint = (): Breakpoint => {
  if (typeof window === 'undefined') return 'xs';
  
  const width = window.innerWidth;
  
  if (width >= breakpoints['2xl']) return '2xl';
  if (width >= breakpoints.xl) return 'xl';
  if (width >= breakpoints.lg) return 'lg';
  if (width >= breakpoints.md) return 'md';
  if (width >= breakpoints.sm) return 'sm';
  return 'xs';
};

/**
 * React hook to track current breakpoint
 * Import React when using this hook:
 * import { useState, useEffect } from 'react';
 */
export const createUseBreakpoint = () => {
  // This will be used in a separate hook file if needed
  // For now, use getCurrentBreakpoint() directly
  return getCurrentBreakpoint;
};

