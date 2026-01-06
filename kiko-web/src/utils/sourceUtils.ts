/**
 * Utility functions for handling source URLs and logos
 */

export type Citation = string | { url: string; avatar_url?: string };

/**
 * Extract URL from citation (string or object)
 */
export function getCitationUrl(citation: Citation): string {
  if (typeof citation === 'string') {
    return citation;
  }
  return citation.url;
}

/**
 * Extract avatar URL from citation if available
 */
export function getCitationAvatarUrl(citation: Citation): string | null {
  if (typeof citation === 'object' && citation.avatar_url) {
    return citation.avatar_url;
  }
  return null;
}

/**
 * Extract domain from URL
 */
export function getSourceDomain(url: string): string {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.replace('www.', '');
  } catch {
    return url;
  }
}

/**
 * Check if URL is an X/Twitter post
 */
export function isXPost(url: string): boolean {
  return url.includes('twitter.com') || url.includes('x.com');
}

/**
 * Get favicon URL for a domain (fallback if avatar_url not available)
 */
export function getFaviconUrl(domain: string): string {
  // Use Google's favicon service with higher size for better quality
  return `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
}

/**
 * Get source title/name from URL
 */
export function getSourceTitle(url: string): string {
  if (isXPost(url)) {
    return 'X (Twitter) Post';
  }
  return getSourceDomain(url);
}

/**
 * Get source logo component props
 */
export function getSourceLogoProps(citation: Citation) {
  const url = getCitationUrl(citation);
  const avatarUrl = getCitationAvatarUrl(citation);
  const domain = getSourceDomain(url);
  const isX = isXPost(url);

  return {
    url,
    domain,
    isX,
    // Always use favicon as fallback if no avatar_url (including for X/Twitter)
    avatarUrl: avatarUrl || getFaviconUrl(domain),
  };
}

