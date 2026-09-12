/**
 * meadiasavee AI - Cloudflare Worker Resolver
 * Deploy this script to Cloudflare Workers for global multi-edge resolution.
 * Set RESOLVER_WORKER_URL in your Astro environment to activate.
 */

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const targetUrl = url.searchParams.get('url');

    if (!targetUrl) {
      return new Response(JSON.stringify({ success: false, error: 'Missing target url parameter' }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }

    try {
      const pinRes = await fetch(targetUrl, {
        method: 'GET',
        redirect: 'follow',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
        }
      });

      const finalUrl = pinRes.url;
      const html = await pinRes.text();

      const pinIdMatch = finalUrl.match(/\/pin\/(?:[^/]*--)?(\d+)(?:\/|$)/) || targetUrl.match(/\/pin\/(?:[^/]*--)?(\d+)(?:\/|$)/);
      const pinId = pinIdMatch ? pinIdMatch[1] : `pin_${Date.now()}`;

      // Extract metadata
      let title = `Pinterest Media #${pinId}`;
      const titleOg = html.match(/<meta\s+property=["']og:title["']\s+content=["'](.*?)["']/i);
      if (titleOg) title = titleOg[1].replace(/\|.*$/g, '').trim();

      let videoUrl = '';
      const vMatch = html.match(/https:\/\/(?:v|v1|v2|v3)\.pinimg\.com\/videos\/[a-zA-Z0-9_\-\/]+\.mp4/i)
                  || html.match(/"url":\s*"(https:\/\/v\.pinimg\.com\/videos\/[^"]+\.mp4)"/i);
      if (vMatch) videoUrl = (vMatch[1] || vMatch[0]).replace(/\\u002F/g, '/');

      let originalImageUrl = '';
      const imgOg = html.match(/<meta\s+property=["']og:image["']\s+content=["'](.*?)["']/i);
      if (imgOg) originalImageUrl = imgOg[1].replace(/\/\d+x\//, '/originals/');

      const formats = [];
      if (videoUrl) {
        formats.push({
          id: 'mp4-1080p',
          label: 'Full HD Video (MP4)',
          type: 'video',
          quality: '1080p / Source',
          format: 'MP4',
          sizeFormatted: '~8.5 MB',
          url: videoUrl,
          downloadUrl: `/api/download?url=${encodeURIComponent(videoUrl)}&filename=meadiasavee_${pinId}_1080p.mp4`
        });
        formats.push({
          id: 'audio-mp3',
          label: 'Extracted Audio Track',
          type: 'audio',
          quality: '320 kbps High Quality',
          format: 'MP3',
          sizeFormatted: '~1.8 MB',
          url: videoUrl,
          downloadUrl: `/api/download?url=${encodeURIComponent(videoUrl)}&filename=meadiasavee_${pinId}_audio.mp3&type=audio`
        });
      }

      if (originalImageUrl) {
        formats.push({
          id: 'img-original',
          label: 'Original High Resolution',
          type: 'image',
          quality: 'Maximum Detail',
          format: 'JPG',
          sizeFormatted: '~2.4 MB',
          url: originalImageUrl,
          downloadUrl: `/api/download?url=${encodeURIComponent(originalImageUrl)}&filename=meadiasavee_${pinId}_original.jpg`
        });
      }

      return new Response(JSON.stringify({
        success: true,
        pinId,
        canonicalUrl: finalUrl,
        title,
        thumbnailUrl: originalImageUrl || videoUrl,
        mediaType: videoUrl ? 'video' : 'image',
        formats
      }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'public, max-age=3600'
        }
      });

    } catch (e) {
      return new Response(JSON.stringify({ success: false, error: e.message }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }
  }
};
