/**
 * Utility functions for URL handling and validation
 */

// Comprehensive URL validation regex
export const URL_PATTERN = /^(?:(?:https?:\/\/)?(?:www\.)?)?[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*(?:\/[^\s]*)?$/;

// Simple URL detection for auto-linking
export const SIMPLE_URL_PATTERN = /((?:https?:\/\/|www\.)[^\s<>"'\[\]()]+[^\s<>"'\[\]().,;:])/gi;

/**
 * Check if a string is a valid URL
 */
export const isValidUrl = (str: string): boolean => {
  try {
    new URL(str.startsWith('http') ? str : `https://${str}`);
    return true;
  } catch {
    return URL_PATTERN.test(str);
  }
};

/**
 * Normalize a URL by adding protocol if missing
 */
export const normalizeUrl = (url: string): string => {
  if (!url) return '';
  
  // If it already has a protocol, return as is
  if (/^https?:\/\//i.test(url)) {
    return url;
  }
  
  // If it starts with www, add https
  if (/^www\./i.test(url)) {
    return `https://${url}`;
  }
  
  // If it looks like a domain, add https
  if (/^[a-zA-Z0-9]/.test(url) && url.includes('.')) {
    return `https://${url}`;
  }
  
  return url;
};

/**
 * Extract domain from URL for display purposes
 */
export const extractDomain = (url: string): string => {
  try {
    const normalizedUrl = normalizeUrl(url);
    const urlObj = new URL(normalizedUrl);
    return urlObj.hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
};

/**
 * Check if URL is external (not same domain)
 */
export const isExternalUrl = (url: string): boolean => {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname !== window.location.hostname;
  } catch {
    return true; // Assume external if we can't parse
  }
};

/**
 * Auto-link URLs in text while preserving existing markdown links
 */
export const autoLinkUrls = (text: string): string => {
  return text.replace(SIMPLE_URL_PATTERN, (match, url, offset) => {
    const beforeMatch = text.substring(0, offset);
    const afterMatch = text.substring(offset + url.length);
    
    // Don't convert if it's already in markdown link format
    if (beforeMatch.endsWith('](') || beforeMatch.endsWith('[') || 
        afterMatch.startsWith(')') || beforeMatch.match(/\[[^\]]*$/)) {
      return url;
    }
    
    const normalizedUrl = normalizeUrl(url);
    return `[${url}](${normalizedUrl})`;
  });
};

/**
 * Convert markdown links back to plain URLs
 */
export const unmarkdownUrls = (text: string): string => {
  const markdownLinkPattern = /\[([^\]]+)\]\(([^)]+)\)/g;
  return text.replace(markdownLinkPattern, (match, linkText, url) => {
    // If link text is the same as URL (or similar), just return the URL
    if (linkText === url || linkText === url.replace(/^https?:\/\//, '')) {
      return url;
    }
    return match; // Keep as markdown link if text is different
  });
};