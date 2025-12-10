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
    
    const found = projectMembers.find(member => 
      member.name.toLowerCase().includes(mentionLower) ||
      member.email.toLowerCase().startsWith(mentionLower)
    );
    
    if (found) {
      userIds.add(found.id);
    }
  }
  
  return Array.from(userIds);
}
