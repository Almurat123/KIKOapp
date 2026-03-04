/**
 * Utility functions for handling source URLs and logos
 */

export type Citation = string | { url: string; avatar_url?: string };

/**
 * Extract URL from citation (string or object)
 */
export function getCitationUrl(citation: Citation): string {
  const parsed = parseCitation(citation);
  if (typeof parsed === 'string') {
    return parsed;
  }
  return parsed.url || '';
}

/**
 * Extract avatar URL from citation if available
 */
export function getCitationAvatarUrl(citation: Citation): string | null {
  const parsed = parseCitation(citation);
  if (typeof parsed === 'object' && ('avatar_url' in parsed || 'avatarUrl' in parsed)) {
    return (parsed as any).avatar_url || (parsed as any).avatarUrl || null;
  }
  return null;
}

/**
 * Robustly parse poorly-formatted citations from backend (e.g. Python string lists "['url']")
 */
export function parseCitation(citation: Citation): Citation {
  let parsedCitation: any = citation;

  if (typeof citation === 'string' && citation.startsWith('[') && citation.endsWith(']')) {
    try {
      const parsed = JSON.parse(citation.replace(/'/g, '"'));
      if (Array.isArray(parsed) && parsed.length > 0) {
        parsedCitation = { url: parsed[0] };
      }
    } catch {
      parsedCitation = { url: citation };
    }
  } else if (typeof citation === 'object' && citation !== null && (citation as any).url) {
    const urlValue = (citation as any).url;
    if (typeof urlValue === 'string' && urlValue.startsWith('[') && urlValue.endsWith(']')) {
      try {
        const parsed = JSON.parse(urlValue.replace(/'/g, '"'));
        if (Array.isArray(parsed) && parsed.length > 0) {
          parsedCitation = {
            ...citation,
            url: parsed[0],
          };
        }
      } catch {
        // Keep original
      }
    }
  }

  return parsedCitation as Citation;
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
  let avatarUrl = getCitationAvatarUrl(citation);
  const domain = getSourceDomain(url);
  const isX = isXPost(url);

  // For X/Twitter posts, if we don't have a specific avatar from the backend,
  // we can use a reliable third-party service like unavatar.io to get the profile picture.
  if (isX && !avatarUrl) {
    try {
      const urlObj = new URL(url);
      const pathParts = urlObj.pathname.split('/').filter(Boolean);
      if (pathParts.length >= 1 && pathParts[0] !== 'status') {
        avatarUrl = `https://unavatar.io/x/${pathParts[0]}`;
      }
    } catch {
      // Ignore URL errors
    }
  }

  return {
    url,
    domain,
    isX,
    // Use avatarUrl if found, otherwise fallback to favicon
    avatarUrl: avatarUrl || getFaviconUrl(domain),
  };
}

