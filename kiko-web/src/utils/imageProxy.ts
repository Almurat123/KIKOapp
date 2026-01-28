const API_BASE_URL = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');

export function proxyImageUrl(url?: string): string {
  if (!url) return '';
  if (url.startsWith('data:')) return url;
  const base = API_BASE_URL ? `${API_BASE_URL}/api/images/token` : '/api/images/token';
  return `${base}?url=${encodeURIComponent(url)}`;
}

