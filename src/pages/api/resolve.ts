import type { APIRoute } from 'astro';
import { resolvePinterestMedia, isValidPinterestUrl } from '../../lib/pinterest-resolver';
import { checkRateLimit } from '../../lib/rate-limiter';

export const prerender = false;

export const POST: APIRoute = async ({ request, clientAddress }) => {
  // IP Rate Limiting (30 requests/minute per IP)
  const clientIp = clientAddress || request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || '127.0.0.1';
  const rateLimit = checkRateLimit(clientIp, 30, 60_000);

  if (!rateLimit.allowed) {
    return new Response(JSON.stringify({ 
      success: false, 
      error: 'Rate limit exceeded. Please wait a minute before making more download requests.' 
    }), {
      status: 429,
      headers: { 
        'Content-Type': 'application/json',
        'Retry-After': '60'
      }
    });
  }

  try {
    const body = await request.json();
    const rawUrl = String(body.url || '').trim();

    if (!rawUrl) {
      return new Response(JSON.stringify({ success: false, error: 'Please enter a Pinterest URL.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (!isValidPinterestUrl(rawUrl)) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Invalid URL. Please enter a valid Pinterest link (e.g. https://pin.it/... or https://pinterest.com/pin/...)' 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Check optional Worker Proxy switch
    const workerProxyUrl = process.env.RESOLVER_WORKER_URL;
    if (workerProxyUrl) {
      try {
        const workerRes = await fetch(`${workerProxyUrl}?url=${encodeURIComponent(rawUrl)}`, {
          headers: { 'Accept': 'application/json' }
        });
        if (workerRes.ok) {
          const workerData = await workerRes.json();
          if (workerData && workerData.success) {
            return new Response(JSON.stringify(workerData), {
              status: 200,
              headers: { 
                'Content-Type': 'application/json',
                'X-RateLimit-Remaining': String(rateLimit.remaining)
              }
            });
          }
        }
      } catch (workerErr) {
        console.warn('Worker proxy fallback to direct backend resolver:', workerErr);
      }
    }

    // Resolve media
    const result = await resolvePinterestMedia(rawUrl);

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=3600',
        'X-RateLimit-Remaining': String(rateLimit.remaining)
      }
    });

  } catch (err: any) {
    console.error('Resolver API Error:', err);
    return new Response(JSON.stringify({
      success: false,
      error: err.message || 'Unable to resolve the requested Pin. It might be private or deleted.'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
