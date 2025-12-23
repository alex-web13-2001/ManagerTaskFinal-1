/**
 * Extract YouTube video ID from URL
 */
export function extractYouTubeId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\?\/]+)/,
    /youtube\.com\/embed\/([^&\?\/]+)/,
    /youtube\.com\/v\/([^&\?\/]+)/
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
