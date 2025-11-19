import { useState, useEffect } from 'react';
import { getCurrentBreakpoint, type Breakpoint } from './breakpoints';

/**
 * React hook to track current breakpoint
 */
export const useBreakpoint = (): Breakpoint => {
  const [breakpoint, setBreakpoint] = useState<Breakpoint>(() => {
    if (typeof window === 'undefined') return 'xs';
    return getCurrentBreakpoint();
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleResize = () => {
      setBreakpoint(getCurrentBreakpoint());
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return breakpoint;
};

