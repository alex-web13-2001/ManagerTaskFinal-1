/**
 * Утилиты для работы с упоминаниями в комментариях
 */

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
        // Sanitize email prefix the same way frontend does: only word chars, dots, hyphens
        const sanitizedPrefix = emailPrefix.replace(/[^\w.-]/g, '').toLowerCase();
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
