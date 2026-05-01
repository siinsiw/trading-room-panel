import { useEffect, useState } from 'react';
import { DesktopShell } from './DesktopShell';
import { MobileShell } from './MobileShell';

const MOBILE_BREAKPOINT = 768;

export function ResponsiveShell() {
  const [isMobile, setIsMobile] = useState(window.innerWidth < MOBILE_BREAKPOINT);

  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  return isMobile ? <MobileShell /> : <DesktopShell />;
}
