// In-memory sliding window rate limiter for API endpoints

interface RateLimitRecord {
  timestamps: number[];
}

const rateLimitMap = new Map<string, RateLimitRecord>();

// Cleanup is handled lazily inside checkRateLimit to avoid global scope intervals

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
