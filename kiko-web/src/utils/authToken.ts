// Simple global supplier for Privy access tokens
// Set by a React component using usePrivy; consumed by API services.

let tokenProvider: (() => Promise<string | null>) | null = null;
let cachedToken: string | null = null;
let cachedAt: number = 0;
let inflight: Promise<string | null> | null = null;

// Token cache duration: 5 minutes (Privy tokens are typically valid for 60 mins)
const TOKEN_CACHE_DURATION_MS = 5 * 60 * 1000;

export function setAuthTokenProvider(provider: () => Promise<string | null>) {
  tokenProvider = provider;
  cachedToken = null;
  cachedAt = 0;
  inflight = null;
  // Provider set
}

export async function getAuthToken(): Promise<string | null> {
  // Check if cached token is still valid
  const now = Date.now();
  if (cachedToken && (now - cachedAt) < TOKEN_CACHE_DURATION_MS) {
    // Using cached token
    return cachedToken;
  }

  if (!tokenProvider) {
    // No token provider set
    return null;
  }

  // Avoid concurrent token fetches
  if (!inflight) {
    inflight = (async () => {
      try {
        // Fetching fresh token from Privy
        const t = await tokenProvider!();
        if (t) {
          cachedToken = t;
          cachedAt = Date.now();
          // Token obtained successfully
        } else {
          // Provider returned null
        }
        return t;
      } catch (err) {
        console.error('[authToken] Failed to get token', err);
        return null;
      } finally {
        inflight = null;
      }
    })();
  }

  return inflight;
}

// Force refresh token on next request (useful after session changes)
export function clearAuthTokenCache() {
  cachedToken = null;
  cachedAt = 0;
  inflight = null;
  // Cache cleared
}
