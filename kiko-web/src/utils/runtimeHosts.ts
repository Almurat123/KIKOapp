const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '0.0.0.0', '::1', '[::1]']);

function normalizeHost(host: string | undefined | null): string {
  return String(host || '').trim().toLowerCase();
}

function isPrivateIpv4(host: string): boolean {
  const normalized = normalizeHost(host);
  if (!/^\d{1,3}(?:\.\d{1,3}){3}$/.test(normalized)) return false;
  const parts = normalized.split('.').map(Number);
  if (parts.some((part) => Number.isNaN(part) || part < 0 || part > 255)) return false;

  if (parts[0] === 10) return true;
  if (parts[0] === 127) return true;
  if (parts[0] === 192 && parts[1] === 168) return true;
  if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
  if (parts[0] === 169 && parts[1] === 254) return true;
  return false;
}

export function isLocalLikeHost(host: string | undefined | null): boolean {
  const normalized = normalizeHost(host);
  if (!normalized) return false;
  if (LOOPBACK_HOSTS.has(normalized)) return true;
  if (normalized.endsWith('.local')) return true;
  if (normalized === 'host.docker.internal') return true;
  return isPrivateIpv4(normalized);
}

export function getCurrentBrowserHostname(): string {
  if (typeof window === 'undefined') return '';
  return normalizeHost(window.location.hostname);
}

export function adaptLoopbackUrlForBrowser(rawUrl: string): string {
  if (typeof window === 'undefined') return rawUrl;

  const currentHost = getCurrentBrowserHostname();
  if (!isLocalLikeHost(currentHost)) {
    return rawUrl;
  }

  try {
    const parsed = new URL(rawUrl);
    if (!LOOPBACK_HOSTS.has(normalizeHost(parsed.hostname))) {
      return rawUrl;
    }

    parsed.hostname = currentHost;
    return parsed.toString().replace(/\/+$/, '');
  } catch {
    return rawUrl;
  }
}
