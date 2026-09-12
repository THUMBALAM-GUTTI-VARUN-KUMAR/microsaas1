import type { APIRoute } from 'astro';

export const prerender = false;

// Strict 500 MB backend guardrail
const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500 MB

export const GET: APIRoute = async ({ request }) => {
  const urlObj = new URL(request.url);
  const mediaUrl = urlObj.searchParams.get('url');
  let filename = urlObj.searchParams.get('filename') || 'meadiasavee_download';
  const typeParam = urlObj.searchParams.get('type') || '';

  if (!mediaUrl) {
    return new Response('Missing media URL parameter', { status: 400 });
  }

  try {
    const parsedTarget = new URL(mediaUrl);
    // Allow Pinterest CDN domains
    const isAllowedHost = /(^|\.)pinimg\.com$/i.test(parsedTarget.hostname) || /(^|\.)pinterest\.com$/i.test(parsedTarget.hostname);
    if (!isAllowedHost) {
      return new Response('Invalid media source domain', { status: 403 });
    }

    const mediaRes = await fetch(mediaUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Referer': 'https://www.pinterest.com/'
      }
    });

    if (!mediaRes.ok) {
      return new Response(`Failed to fetch media from provider: ${mediaRes.statusText}`, { status: mediaRes.status });
    }

    const contentLength = mediaRes.headers.get('content-length');
    if (contentLength && parseInt(contentLength, 10) > MAX_FILE_SIZE) {
      return new Response('File size exceeds the maximum allowed server limit of 500 MB.', { status: 413 });
    }

    // Determine correct extension & MIME type
    let finalExt = 'jpg';
    let contentType = 'image/jpeg';

    if (typeParam === 'audio' || filename.endsWith('.mp3')) {
      finalExt = 'mp3';
      contentType = 'audio/mpeg';
    } else if (mediaUrl.includes('.mp4') || filename.endsWith('.mp4')) {
      finalExt = 'mp4';
      contentType = 'video/mp4';
    } else if (mediaUrl.includes('.png') || filename.endsWith('.png')) {
      finalExt = 'png';
      contentType = 'image/png';
    } else if (mediaUrl.includes('.gif') || filename.endsWith('.gif')) {
      finalExt = 'gif';
      contentType = 'image/gif';
    } else if (mediaUrl.includes('.webp') || filename.endsWith('.webp')) {
      finalExt = 'webp';
      contentType = 'image/webp';
    }

    // Clean and ensure filename has proper extension
    filename = filename.replace(/[^a-zA-Z0-9_\-\.]/g, '_');
    if (!filename.toLowerCase().endsWith(`.${finalExt}`)) {
      filename = `${filename}.${finalExt}`;
    }

    // Fetch array buffer for bulletproof cross-browser binary response
    const arrayBuffer = await mediaRes.arrayBuffer();

    const headers = new Headers();
    // Use standard attachment header with explicit filename
    headers.set('Content-Disposition', `attachment; filename="${filename}"; filename*="UTF-8''${encodeURIComponent(filename)}"`);
    headers.set('Content-Type', contentType);
    headers.set('Content-Length', String(arrayBuffer.byteLength));
    headers.set('Access-Control-Allow-Origin', '*');
    headers.set('Access-Control-Expose-Headers', 'Content-Disposition, Content-Length, Content-Type');
    headers.set('Cache-Control', 'public, max-age=86400');

    return new Response(arrayBuffer, {
      status: 200,
      headers
    });

  } catch (err: any) {
    console.error('Download proxy streaming error:', err);
    return new Response('Error streaming requested media', { status: 500 });
  }
};
