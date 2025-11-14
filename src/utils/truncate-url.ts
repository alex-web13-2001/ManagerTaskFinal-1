/**
 * Truncates a long URL smartly, keeping beginning and end visible
 * @param url - The URL to truncate
 * @param maxLength - Maximum length (default: 60)
 * @returns Truncated URL with "..." in the middle
 */
export const truncateUrl = (url: string, maxLength: number = 60): string => {
  if (url.length <= maxLength) return url;
  
  // Smart truncation: show 60% of start + 30% of end
  const startLength = Math.floor(maxLength * 0.6); // 36 chars
  const endLength = Math.floor(maxLength * 0.3);   // 18 chars
  
  return `${url.slice(0, startLength)}...${url.slice(-endLength)}`;
};
