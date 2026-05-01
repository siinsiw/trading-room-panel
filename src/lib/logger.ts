const isDev = import.meta.env.DEV;

export const logger = {
  log:   (...args: unknown[]) => { if (isDev) console.log('[TR]', ...args); },
  warn:  (...args: unknown[]) => { if (isDev) console.warn('[TR]', ...args); },
  error: (...args: unknown[]) => { if (isDev) console.error('[TR]', ...args); },
  info:  (...args: unknown[]) => { if (isDev) console.info('[TR]', ...args); },
};
