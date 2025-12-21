/**
 * Утилиты для работы с упоминаниями в комментариях
 */

// Regex pattern for sanitizing usernames - matches frontend implementation
// Keeps only: \w (word chars: a-z, A-Z, 0-9, _), dots (.), and hyphens (-)
// Removes special characters like +, !, etc.
const USERNAME_SANITIZE_PATTERN = /[^\w.-]/g;

export function extractMentions(text: string): string[] {
  const mentionRegex = /@([\w.-]+)/g;
  const matches = text.matchAll(mentionRegex);
  return Array.from(matches).map(match => match[1]);
}

export function getUsersByMentions(
  mentions: string[], 
  projectMembers: Array<{id: string, name: string, email: string}>
): string[] {
  const userIds = new Set<string>();
  
  for (const mention of mentions) {
    const mentionLower = mention.toLowerCase();
    
    const found = projectMembers.find(member => {
      // Check if name includes the mention
      if (member.name && member.name.toLowerCase().includes(mentionLower)) {
        return true;
      }
      
      // Check if email prefix matches (after sanitization)
      if (member.email && member.email.includes('@')) {
        const emailPrefix = member.email.split('@')[0];
        // Sanitize using the same pattern as frontend (defined at top of file)
        const sanitizedPrefix = emailPrefix.replace(USERNAME_SANITIZE_PATTERN, '').toLowerCase();
        return sanitizedPrefix === mentionLower;
      }
      
      return false;
    });
    
    if (found) {
      userIds.add(found.id);
    }
  }
  
  return Array.from(userIds);
}
