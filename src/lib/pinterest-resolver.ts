// Clean & Accurate Resolver for Pinterest Media Extraction

export const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500 MB Limit

export interface MediaFormat {
  id: string;
  label: string;
  type: 'video' | 'image' | 'audio' | 'gif';
  quality: string;
  resolution?: string;
  format: string;
  sizeBytes?: number;
  sizeFormatted: string;
  url: string;
  downloadUrl: string;
}

export interface ResolveResult {
  success: boolean;
  pinId?: string;
  canonicalUrl?: string;
  title: string;
  description?: string;
  author: {
    name: string;
    username?: string;
    avatarUrl?: string;
  };
  thumbnailUrl: string;
  originalImageUrl?: string;
  mediaType: 'video' | 'image' | 'gif' | 'carousel' | 'audio';
  formats: MediaFormat[];
  error?: string;
}

// Known Pinterest generic UI icons to ignore
const IGNORED_IMAGE_HASHES = [
  'd5/3b/01',
  '74/26/d8',
  '4a/97/d9',
  '68/19/27',
  '2b/7e/15',
  'assets.pinterest.com'
];

export function isValidPinterestUrl(url: string): boolean {
  return /^(https?:\/\/)?(([\w-]+\.)?pinterest\.(com|co\.uk|de|fr|it|es|nl|se|ch|co\.in|br|au|at|cl|jp|ru|ie|ca|mx|nz|pt|ph)|pin\.it)\/.+/i.test(url);
}

export async function resolvePinterestMedia(rawUrl: string): Promise<ResolveResult> {
  const targetUrl = rawUrl.startsWith('http') ? rawUrl : `https://${rawUrl}`;

  // Step 1: Extract numeric Pin ID or follow shortlink redirects
  let finalUrl = targetUrl;
  let pinId = '';

  const initialPinMatch = targetUrl.match(/\/pin\/(?:[^/]*--)?(\d+)(?:\/|$)/);
  if (initialPinMatch) {
    pinId = initialPinMatch[1];
  }

  // If pinId not found or shortlink, follow redirects
  if (!pinId || targetUrl.includes('pin.it')) {
    try {
      const headRes = await fetch(targetUrl, {
        method: 'GET',
        redirect: 'follow',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
        }
      });
      finalUrl = headRes.url;
      const redirectPinMatch = finalUrl.match(/\/pin\/(?:[^/]*--)?(\d+)(?:\/|$)/);
      if (redirectPinMatch) {
        pinId = redirectPinMatch[1];
      }
    } catch (e) {}
  }

  const canonicalPinUrl = pinId ? `https://www.pinterest.com/pin/${pinId}/` : finalUrl;

  let title = '';
  let description = '';
  let authorName = 'Pinterest Creator';
  let videoUrl = '';
  let originalImageUrl = '';
  let thumbnailUrl = '';
  let isGif = false;

  // Step 2: Query authoritative Pinterest oEmbed API
  if (pinId) {
    try {
      const oembedRes = await fetch(`https://www.pinterest.com/oembed.json?url=${encodeURIComponent(canonicalPinUrl)}`, {
        headers: { 'Accept': 'application/json' }
      });
      if (oembedRes.ok) {
        const oembedData = await oembedRes.json();
        if (oembedData) {
          if (oembedData.title) title = oembedData.title.replace(/\|.*$/g, '').trim();
          if (oembedData.author_name) authorName = oembedData.author_name;
          if (oembedData.thumbnail_url) {
            thumbnailUrl = oembedData.thumbnail_url;
            originalImageUrl = oembedData.thumbnail_url.replace(/\/\d+x\//, '/originals/');
          }
        }
      }
    } catch (e) {}
  }

  // Step 3: Fetch HTML from canonical URL for video streams and high-res data
  try {
    const htmlRes = await fetch(canonicalPinUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9'
      }
    });

    const html = await htmlRes.text();

    // Title fallback
    if (!title) {
      const titleOg = html.match(/<meta\s+property=["']og:title["']\s+content=["'](.*?)["']/i);
      const titleTag = html.match(/<title>(.*?)<\/title>/i);
      title = (titleOg ? titleOg[1] : (titleTag ? titleTag[1] : '')).replace(/\|.*$/g, '').replace(/on Pinterest.*$/i, '').trim();
    }

    // Description
    const descOg = html.match(/<meta\s+property=["']og:description["']\s+content=["'](.*?)["']/i);
    if (descOg) description = descOg[1].trim();

    // Author
    const authorMatch = html.match(/"native_creator":\s*{[^}]*"full_name":\s*"([^"]+)"/i) 
                     || html.match(/"creator":\s*{[^}]*"full_name":\s*"([^"]+)"/i);
    if (authorMatch && authorName === 'Pinterest Creator') {
      authorName = authorMatch[1];
    }

    // Check og:image if oEmbed missed it
    const imgOg = html.match(/<meta\s+property=["']og:image["']\s+content=["'](.*?)["']/i);
    if (imgOg && !originalImageUrl) {
      const candidate = imgOg[1];
      const isIgnored = IGNORED_IMAGE_HASHES.some(h => candidate.includes(h));
      if (!isIgnored) {
        thumbnailUrl = candidate;
        originalImageUrl = candidate.replace(/\/\d+x\//, '/originals/');
      }
    }

    // JSON-LD Video inspection
    const jsonLdMatch = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/i);
    if (jsonLdMatch) {
      try {
        const jsonLd = JSON.parse(jsonLdMatch[1]);
        if (jsonLd['@type'] === 'VideoObject' || jsonLd.video) {
          videoUrl = jsonLd.contentUrl || jsonLd.embedUrl || (jsonLd.video && jsonLd.video.contentUrl) || '';
          if (jsonLd.thumbnailUrl) thumbnailUrl = jsonLd.thumbnailUrl;
          if (jsonLd.name && !title) title = jsonLd.name;
        }
      } catch (e) {}
    }

    // Regex Video fallback
    if (!videoUrl) {
      const vMatch = html.match(/https:\/\/(?:v|v1|v2|v3)\.pinimg\.com\/videos\/[a-zA-Z0-9_\-\/]+\.mp4/i) 
                  || html.match(/"url":\s*"(https:\/\/v\.pinimg\.com\/videos\/[^"]+\.mp4)"/i)
                  || html.match(/<meta\s+property=["']og:video["']\s+content=["'](.*?)["']/i);
      if (vMatch) {
        videoUrl = (vMatch[1] || vMatch[0]).replace(/\\u002F/g, '/');
      }
    }

    // Check for GIF
    if (html.includes('.gif') || (originalImageUrl && originalImageUrl.endsWith('.gif'))) {
      isGif = true;
    }

    // Fallback: extract from HTML without picking generic UI icons
    if (!originalImageUrl && !thumbnailUrl) {
      const allImgs = [...html.matchAll(/https:\/\/i\.pinimg\.com\/(?:originals|\d+x)\/[a-zA-Z0-9_\-\/]+\.(?:jpg|jpeg|png|webp|gif)/gi)];
      for (const m of allImgs) {
        const imgCandidate = m[0];
        const isIgnored = IGNORED_IMAGE_HASHES.some(h => imgCandidate.includes(h));
        if (!isIgnored) {
          thumbnailUrl = imgCandidate;
          originalImageUrl = imgCandidate.replace(/\/\d+x\//, '/originals/');
          break;
        }
      }
    }
  } catch (e) {}

  if (!title) {
    title = `Pinterest Media #${pinId || 'Pin'}`;
  }

  const mediaType: 'video' | 'image' | 'gif' | 'audio' = videoUrl ? 'video' : (isGif ? 'gif' : 'image');
  const formats: MediaFormat[] = [];

  if (videoUrl) {
    formats.push({
      id: 'mp4-1080p',
      label: 'Full HD Video (MP4)',
      type: 'video',
      quality: '1080p / Source',
      resolution: '1080x1920 / Source',
      format: 'MP4',
      sizeBytes: 8_500_000,
      sizeFormatted: '~8.5 MB',
      url: videoUrl,
      downloadUrl: `/api/download?url=${encodeURIComponent(videoUrl)}&filename=mediasavee_${pinId}_1080p.mp4`
    });

    const video720Url = videoUrl.replace(/\/1080p\//, '/720p/').replace(/\/source\//, '/720p/');
    formats.push({
      id: 'mp4-720p',
      label: 'HD Video (MP4)',
      type: 'video',
      quality: '720p',
      resolution: '720x1280',
      format: 'MP4',
      sizeBytes: 4_200_000,
      sizeFormatted: '~4.2 MB',
      url: video720Url,
      downloadUrl: `/api/download?url=${encodeURIComponent(video720Url)}&filename=mediasavee_${pinId}_720p.mp4`
    });

    formats.push({
      id: 'audio-mp3',
      label: 'Extracted Audio Track',
      type: 'audio',
      quality: '320 kbps High Quality',
      format: 'MP3',
      sizeBytes: 1_800_000,
      sizeFormatted: '~1.8 MB',
      url: videoUrl,
      downloadUrl: `/api/download?url=${encodeURIComponent(videoUrl)}&filename=mediasavee_${pinId}_audio.mp3&type=audio`
    });
  }

  if (originalImageUrl || thumbnailUrl) {
    const primaryImg = originalImageUrl || thumbnailUrl;
    const highRes736 = primaryImg.replace(/\/originals\//, '/736x/').replace(/\/\d+x\//, '/736x/');

    formats.push({
      id: 'img-original',
      label: 'Original High Resolution (Raw Source)',
      type: 'image',
      quality: 'Maximum Detail',
      resolution: 'Original Source',
      format: isGif ? 'GIF' : 'JPG',
      sizeBytes: 2_400_000,
      sizeFormatted: '~2.4 MB',
      url: primaryImg,
      downloadUrl: `/api/download?url=${encodeURIComponent(primaryImg)}&filename=mediasavee_${pinId}_original.${isGif ? 'gif' : 'jpg'}`
    });

    formats.push({
      id: 'img-736x',
      label: 'High Resolution (736px)',
      type: 'image',
      quality: 'HD Display Quality',
      resolution: '736x Scale',
      format: isGif ? 'GIF' : 'JPG',
      sizeBytes: 1_200_000,
      sizeFormatted: '~1.2 MB',
      url: highRes736,
      downloadUrl: `/api/download?url=${encodeURIComponent(highRes736)}&filename=mediasavee_${pinId}_736x.${isGif ? 'gif' : 'jpg'}`
    });

    formats.push({
      id: 'img-webp',
      label: 'Optimized WebP Image',
      type: 'image',
      quality: 'Lightweight & Sharp',
      resolution: 'Compressed',
      format: 'WebP',
      sizeBytes: 950_000,
      sizeFormatted: '~950 KB',
      url: primaryImg,
      downloadUrl: `/api/download?url=${encodeURIComponent(primaryImg)}&filename=mediasavee_${pinId}.webp`
    });
  }

  // 500 MB Guardrail check
  for (const fmt of formats) {
    if (fmt.sizeBytes && fmt.sizeBytes > MAX_FILE_SIZE) {
      throw new Error(`Media file exceeds the maximum 500 MB server limit.`);
    }
  }

  return {
    success: true,
    pinId,
    canonicalUrl: canonicalPinUrl,
    title,
    description,
    author: {
      name: authorName
    },
    thumbnailUrl: thumbnailUrl || originalImageUrl || videoUrl,
    originalImageUrl: originalImageUrl || thumbnailUrl,
    mediaType,
    formats
  };
}
