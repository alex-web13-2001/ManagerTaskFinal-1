import express from 'express';
import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

/**
 * Get Instagram post metadata through Open Graph tag parsing
 */
export async function getInstagramMetadata(
  req: express.Request,
  res: express.Response
) {
  try {
    const { url } = req.query;

    if (!url || typeof url !== 'string') {
      return res.status(400).json({ error: 'URL parameter required' });
    }

    // Validate that URL is from Instagram domain (security: prevent SSRF)
    const urlObj = new URL(url);
    const allowedDomains = ['instagram.com', 'www.instagram.com', 'instagr.am'];
    if (!allowedDomains.includes(urlObj.hostname)) {
      return res.status(400).json({ error: 'URL must be from Instagram domain' });
    }

    console.log('[Instagram Metadata] Fetching:', url);

    // Fetch HTML page from Instagram
    const response = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch: ${response.status} ${response.statusText}`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    // Extract Open Graph meta tags
    const ogTitle = $('meta[property="og:title"]').attr('content') || '';
    const ogImage = $('meta[property="og:image"]').attr('content') || '';
    const ogDescription = $('meta[property="og:description"]').attr('content') || '';

    console.log('[Instagram Metadata] Parsed:', {
      titleLength: ogTitle.length,
      hasImage: !!ogImage,
      descriptionLength: ogDescription.length,
    });

    // Parse author from title (usually format: "Author | ... в Instagram: ...")
    let author = 'Instagram';
    const authorMatch = ogTitle.match(/^([^|:]+)/);
    if (authorMatch) {
      author = authorMatch[1].trim();
    }

    // Parse post text (after quotes or colon)
    let title = 'Instagram Post';
    const textMatch = ogTitle.match(/[«":]\s*[«"]?([^»"]+)/);
    if (textMatch && textMatch[1]) {
      const fullText = textMatch[1].trim();
      title = fullText.substring(0, 150) + (fullText.length > 150 ? '...' : '');
    }

    const metadata = {
      title: title || 'Instagram Post',
      thumbnail: ogImage,
      description: ogDescription,
      author: author,
    };

    console.log('[Instagram Metadata] Result:', metadata);

    res.json(metadata);
  } catch (error) {
    console.error('[Instagram Metadata] Error:', error);
    
    // Return fallback data on error
    res.status(500).json({
      error: 'Failed to fetch metadata',
      fallback: {
        title: 'Instagram Post',
        thumbnail: '',
        description: '',
        author: 'Instagram',
      },
    });
  }
}
