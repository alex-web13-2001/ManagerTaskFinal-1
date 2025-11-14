import DOMPurify from 'dompurify';

/**
 * Sanitizes HTML content to prevent XSS attacks
 * Handles both HTML and plain text for backward compatibility
 * @param html - The HTML string to sanitize
 * @returns Sanitized HTML string safe for rendering
 */
export function sanitizeHtml(html: string): string {
  if (!html) return '';
  
  // Check if the content is plain text (no HTML tags)
  const hasHtmlTags = /<[^>]+>/g.test(html);
  
  // If it's plain text, convert newlines to <br> for proper display
  if (!hasHtmlTags) {
    return html.split('\n').map(line => line || '&nbsp;').join('<br>');
  }
  
  // Otherwise sanitize the HTML
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [
      'p', 'br', 'strong', 'em', 'u', 'a', 'ul', 'ol', 'li',
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'code', 'pre'
    ],
    ALLOWED_ATTR: ['href', 'target', 'rel', 'class'],
    ALLOW_DATA_ATTR: false,
  });
}
