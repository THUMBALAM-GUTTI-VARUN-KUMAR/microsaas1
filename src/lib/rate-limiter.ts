// In-memory sliding window rate limiter for API endpoints

interface RateLimitRecord {
  timestamps: number[];
}

const rateLimitMap = new Map<string, RateLimitRecord>();

// Clean up stale entries every 5 minutes
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    for (const [ip, record] of rateLimitMap.entries()) {
      record.timestamps = record.timestamps.filter(t => now - t < 60_000);
      if (record.timestamps.length === 0) {
        rateLimitMap.delete(ip);
      }
    }
  }, 5 * 60 * 1000);
}

/**
 * Checks if a given IP exceeds max requests within the sliding window.
 * @param ip Client IP address
 * @param maxRequests Maximum allowed requests (default 30 per minute)
 * @param windowMs Window in milliseconds (default 60,000 ms)
 */
export function checkRateLimit(ip: string, maxRequests = 30, windowMs = 60_000): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const record = rateLimitMap.get(ip) || { timestamps: [] };

  // Remove timestamps outside the window
  record.timestamps = record.timestamps.filter(t => now - t < windowMs);

  if (record.timestamps.length >= maxRequests) {
    return { allowed: false, remaining: 0 };
  }

  record.timestamps.push(now);
  rateLimitMap.set(ip, record);

  return { allowed: true, remaining: maxRequests - record.timestamps.length };
}
