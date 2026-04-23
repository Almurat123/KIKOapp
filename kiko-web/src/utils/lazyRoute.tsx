import React from 'react';

const CHUNK_LOAD_TIMEOUT_MS = 12000;
const RELOAD_KEY_PREFIX = 'kiko.lazy-route-reload.';

const RETRYABLE_PATTERNS = [
  /Failed to fetch dynamically imported module/i,
  /Importing a module script failed/i,
  /Loading chunk [\d]+ failed/i,
  /route chunk load timed out/i,
  /networkerror/i,
  /not a valid javascript mime type/i,
  /text\/html/i,
];

type ModuleLoader<T extends React.ComponentType<any>> = () => Promise<{ default: T }>;

function normalizeRouteError(routeKey: string, error: unknown): Error {
  if (error instanceof Error) {
    return error;
  }
  return new Error(`Route "${routeKey}" failed to load: ${String(error)}`);
}

function getReloadStorageKey(routeKey: string): string {
  return `${RELOAD_KEY_PREFIX}${routeKey}`;
}

function isRetryableChunkError(error: Error): boolean {
  return RETRYABLE_PATTERNS.some((pattern) => pattern.test(error.message));
}

function shouldReloadOnce(routeKey: string, error: Error): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return false;
  }

  if (!isRetryableChunkError(error)) {
    return false;
  }

  const storageKey = getReloadStorageKey(routeKey);
  if (window.sessionStorage.getItem(storageKey) === '1') {
    return false;
  }

  window.sessionStorage.setItem(storageKey, '1');
  return true;
}

function clearReloadFlag(routeKey: string) {
  if (typeof window === 'undefined') {
    return;
  }
  window.sessionStorage.removeItem(getReloadStorageKey(routeKey));
}

function withTimeout<T>(routeKey: string, loader: Promise<T>): Promise<T> {
  return Promise.race([
    loader,
    new Promise<T>((_, reject) => {
      window.setTimeout(() => {
        reject(new Error(`Route chunk load timed out for "${routeKey}" after ${CHUNK_LOAD_TIMEOUT_MS}ms`));
      }, CHUNK_LOAD_TIMEOUT_MS);
    }),
  ]);
}

export function lazyRoute<T extends React.ComponentType<any>>(
  routeKey: string,
  loader: ModuleLoader<T>
): React.LazyExoticComponent<T> {
  return React.lazy(async () => {
    try {
      const loadedModule = await withTimeout(routeKey, loader());
      clearReloadFlag(routeKey);
      return loadedModule;
    } catch (rawError) {
      const error = normalizeRouteError(routeKey, rawError);
      if (shouldReloadOnce(routeKey, error)) {
        window.location.reload();
        return new Promise<never>(() => {});
      }
      clearReloadFlag(routeKey);
      throw error;
    }
  });
}
