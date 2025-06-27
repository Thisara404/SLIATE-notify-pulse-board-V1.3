import DOMPurify from 'dompurify';

export const sanitizeHtml = (html: string): string => {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'br', 'a', 'ul', 
      'ol', 'li', 'b', 'i', 'strong', 'em', 'strike', 'code', 'hr',
      'table', 'thead', 'tbody', 'tr', 'th', 'td', 'blockquote', 'span'
    ],
    ALLOWED_ATTR: ['href', 'target', 'class', 'style'],
    ALLOWED_URI_REGEXP: /^(?:(?:(?:f|ht)tps?|mailto):)/i,
    FORBID_TAGS: ['script', 'iframe', 'object', 'embed'],
    USE_PROFILES: { html: true }
  });
};