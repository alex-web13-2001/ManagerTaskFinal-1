/**
 * Telegram bot utilities and constants
 */

/**
 * Priority emoji and text mappings for task notifications
 */
export const PRIORITY_EMOJI: Record<string, string> = {
  low: '🟢',
  medium: '🟡',
  high: '🔴',
  urgent: '🚨',
};

export const PRIORITY_TEXT: Record<string, string> = {
  low: 'Низкий',
  medium: 'Средний',
  high: 'Высокий',
  urgent: 'Срочный',
};

/**
 * Get formatted priority tag for a task
 * @param priority - Task priority
 * @returns Formatted string like "🔴 Высокий" or "⚪ Приоритет: custom"
 */
export function getPriorityTag(priority: string): string {
  const emoji = PRIORITY_EMOJI[priority] || '⚪';
  const text = PRIORITY_TEXT[priority];
  
  if (text) {
    return `${emoji} ${text}`;
  }
  
  return `⚪ Приоритет: ${priority}`;
}

/**
 * Moscow timezone offset from UTC (UTC+3, no DST)
 */
export const MOSCOW_UTC_OFFSET_HOURS = 3;

/**
 * Get current date/time in Moscow timezone
 * Note: Moscow is UTC+3 without DST
 */
export function getMoscowDate(date: Date = new Date()): Date {
  const utcTime = date.getTime();
  const moscowTime = utcTime + (MOSCOW_UTC_OFFSET_HOURS * 60 * 60 * 1000);
  return new Date(moscowTime);
}

/**
 * Get start of day in Moscow timezone (00:00:00)
 */
export function getMoscowDayStart(date: Date = new Date()): Date {
  const moscowDate = getMoscowDate(date);
  const year = moscowDate.getUTCFullYear();
  const month = moscowDate.getUTCMonth();
  const day = moscowDate.getUTCDate();
  
  // Create date at midnight Moscow time
  const dayStart = new Date(Date.UTC(year, month, day, 0, 0, 0, 0));
  // Adjust back to UTC
  return new Date(dayStart.getTime() - (MOSCOW_UTC_OFFSET_HOURS * 60 * 60 * 1000));
}

/**
 * Get end of day in Moscow timezone (23:59:59.999)
 */
export function getMoscowDayEnd(date: Date = new Date()): Date {
  const moscowDate = getMoscowDate(date);
  const year = moscowDate.getUTCFullYear();
  const month = moscowDate.getUTCMonth();
  const day = moscowDate.getUTCDate();
  
  // Create date at end of day Moscow time
  const dayEnd = new Date(Date.UTC(year, month, day, 23, 59, 59, 999));
  // Adjust back to UTC
  return new Date(dayEnd.getTime() - (MOSCOW_UTC_OFFSET_HOURS * 60 * 60 * 1000));
}

/**
 * Format date for deadline display
 * @param dueDate - Task due date
 * @param nowMoscow - Current date in Moscow timezone
 * @returns Formatted string like "сегодня", "завтра", or "DD.MM"
 */
export function formatDeadline(dueDate: Date, nowMoscow: Date = getMoscowDate()): string {
  const dueMoscow = getMoscowDate(dueDate);
  
  const nowDayStart = getMoscowDayStart(nowMoscow);
  const dueDayStart = getMoscowDayStart(dueMoscow);
  
  const diffDays = Math.floor((dueDayStart.getTime() - nowDayStart.getTime()) / (24 * 60 * 60 * 1000));
  
  if (diffDays === 0) {
    return 'сегодня';
  } else if (diffDays === 1) {
    return 'завтра';
  } else {
    // Format as DD.MM
    const day = dueMoscow.getUTCDate().toString().padStart(2, '0');
    const month = (dueMoscow.getUTCMonth() + 1).toString().padStart(2, '0');
    return `${day}.${month}`;
  }
}
