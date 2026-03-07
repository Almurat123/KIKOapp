// Simple global supplier for Privy access tokens
// Set by a React component using usePrivy; consumed by API services.

let tokenProvider: (() => Promise<string | null>) | null = null;
let cachedToken: string | null = null;
let cachedAt: number = 0;
let inflight: Promise<string | null> | null = null;

// Token cache duration: 5 minutes (Privy tokens are typically valid for 60 mins)
const TOKEN_CACHE_DURATION_MS = 5 * 60 * 1000;
const TOKEN_EXPIRY_SAFETY_MS = 30 * 1000;

function getTokenExpiryMs(token: string): number | null {
  try {
    const parts = token.split('.');
    if (parts.length < 2) return null;
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
    const exp = Number(payload?.exp);
    if (!Number.isFinite(exp)) return null;
    return exp * 1000;
  } catch {
    return null;
  }
}

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
    const expMs = getTokenExpiryMs(cachedToken);
    if (expMs && now >= (expMs - TOKEN_EXPIRY_SAFETY_MS)) {
      cachedToken = null;
      cachedAt = 0;
    } else {
    // Using cached token
    return cachedToken;
    }
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
          const expMs = getTokenExpiryMs(t);
          if (expMs && Date.now() >= (expMs - TOKEN_EXPIRY_SAFETY_MS)) {
            return null;
          }
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

export function getCachedAuthTokenSnapshot(): string | null {
  const now = Date.now();
  if (!cachedToken) return null;

  const expMs = getTokenExpiryMs(cachedToken);
  if (expMs && now >= (expMs - TOKEN_EXPIRY_SAFETY_MS)) {
    cachedToken = null;
    cachedAt = 0;
    return null;
  }

  return cachedToken;
}

// Force refresh token on next request (useful after session changes)
export function clearAuthTokenCache() {
  cachedToken = null;
  cachedAt = 0;
  inflight = null;
  // Cache cleared
}
