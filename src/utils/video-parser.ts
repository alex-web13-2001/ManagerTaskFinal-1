/**
 * Extract YouTube video ID from URL
 */
export function extractYouTubeId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\?\/]+)/,
    /youtube\.com\/embed\/([^&\?\/]+)/,
    /youtube\.com\/v\/([^&\?\/]+)/,
    /m\.youtube\.com\/watch\?v=([^&\?\/]+)/,  // Mobile YouTube support
    /youtube\.com\/shorts\/([^&\?\/]+)/        // YouTube Shorts support
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  
  return null;
}

/**
 * Get YouTube video metadata using oEmbed API
 */
export async function getYouTubeMetadata(url: string): Promise<{
  title: string;
  thumbnail: string;
  description: string;
  author: string;
} | null> {
  try {
    const videoId = extractYouTubeId(url);
    if (!videoId) return null;
    
    const response = await fetch(
      `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`
    );
    
    if (!response.ok) return null;
    
    const data = await response.json();
    
    return {
      title: data.title || 'YouTube Video',
      thumbnail: data.thumbnail_url || `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
      description: data.title || '',
      author: data.author_name || 'YouTube'
    };
  } catch (error) {
    console.error('Failed to fetch YouTube metadata:', error);
    return null;
  }
}

/**
 * Validate if URL is a valid YouTube URL
 */
export function isYouTubeUrl(url: string): boolean {
  return extractYouTubeId(url) !== null;
}

/**
 * Extract Instagram Post/Reel ID from URL
 */
export function extractInstagramId(url: string): string | null {
  const patterns = [
    /instagram\.com\/p\/([A-Za-z0-9_-]+)/i,
    /instagram\.com\/reels?\/([A-Za-z0-9_-]+)/i,  // /reel/ OR /reels/
    /instagr\.am\/p\/([A-Za-z0-9_-]+)/i,
    /instagr\.am\/reels?\/([A-Za-z0-9_-]+)/i,     // Short URL with reels
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }
  
  return null;
}

/**
 * Get Instagram content type (post or reel)
 */
export function getInstagramContentType(url: string): 'post' | 'reel' | null {
  // Use regex patterns to reliably detect content type
  const reelPatterns = [
    /instagram\.com\/reels?\//i,  // /reel/ OR /reels/
    /instagr\.am\/reels?\//i,     // Short URL
  ];
  
  const postPatterns = [
    /instagram\.com\/p\//i,
    /instagr\.am\/p\//i,
  ];
  
  for (const pattern of reelPatterns) {
    if (pattern.test(url)) return 'reel';
  }
  
  for (const pattern of postPatterns) {
    if (pattern.test(url)) return 'post';
  }
  
  return null;
}

/**
 * Detect video type by URL
 */
export function detectVideoType(url: string): 'youtube' | 'instagram' | null {
  if (!url || !url.trim()) return null;
  
  if (extractYouTubeId(url)) return 'youtube';
  if (extractInstagramId(url)) return 'instagram';
  
  return null;
}
