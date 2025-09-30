import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

// Create rate limiters with different configurations
// Note: For development without Upstash, we'll use a simple in-memory fallback

// In-memory fallback for development
class InMemoryRateLimiter {
  private requests: Map<string, number[]> = new Map();

  async limit(
    identifier: string,
    limit: number,
    window: number
  ): Promise<{ success: boolean; reset: number }> {
    const now = Date.now();
    const windowStart = now - window;

    // Get existing requests for this identifier
    let timestamps = this.requests.get(identifier) || [];

    // Filter out old requests outside the window
    timestamps = timestamps.filter(timestamp => timestamp > windowStart);

    // Check if limit exceeded
    const success = timestamps.length < limit;

    if (success) {
      timestamps.push(now);
      this.requests.set(identifier, timestamps);
    }

    // Calculate reset time
    const reset = timestamps.length > 0 ? timestamps[0] + window : now + window;

    return { success, reset };
  }

  // Clean up old entries periodically
  cleanup() {
    const now = Date.now();
    for (const [key, timestamps] of this.requests.entries()) {
      const validTimestamps = timestamps.filter(t => t > now - 3600000); // Keep last hour
      if (validTimestamps.length === 0) {
        this.requests.delete(key);
      } else {
        this.requests.set(key, validTimestamps);
      }
    }
  }
}

const inMemoryLimiter = new InMemoryRateLimiter();

// Clean up every 5 minutes
if (typeof window === 'undefined') {
  setInterval(() => inMemoryLimiter.cleanup(), 300000);
}

// Try to use Upstash if credentials are available, otherwise fall back to in-memory
function createRateLimiter(requests: number, window: string) {
  const hasUpstashCredentials =
    process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN;

  if (hasUpstashCredentials) {
    try {
      const redis = new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL!,
        token: process.env.UPSTASH_REDIS_REST_TOKEN!,
      });

      return new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(requests, window),
        analytics: true,
      });
    } catch (error) {
      console.warn(
        'Failed to initialize Upstash Redis, falling back to in-memory rate limiting'
      );
    }
  }

  // Return a compatible wrapper for in-memory rate limiter
  return {
    async limit(identifier: string) {
      const windowMs = parseWindowToMs(window);
      const result = await inMemoryLimiter.limit(
        identifier,
        requests,
        windowMs
      );
      return {
        success: result.success,
        limit: requests,
        remaining: result.success ? requests - 1 : 0,
        reset: result.reset,
      };
    },
  };
}

function parseWindowToMs(window: string): number {
  const match = window.match(/^(\d+)\s*([smhd])$/);
  if (!match) throw new Error(`Invalid window format: ${window}`);

  const value = parseInt(match[1]);
  const unit = match[2];

  const multipliers: Record<string, number> = {
    s: 1000,
    m: 60000,
    h: 3600000,
    d: 86400000,
  };

  return value * multipliers[unit];
}

// Rate limiters for different endpoints
export const registrationLimiter = createRateLimiter(5, '1 h'); // 5 requests per hour
export const loginLimiter = createRateLimiter(10, '15 m'); // 10 requests per 15 minutes
export const passwordResetLimiter = createRateLimiter(3, '1 h'); // 3 requests per hour
export const apiLimiter = createRateLimiter(100, '1 m'); // 100 requests per minute

/**
 * Helper function to get client identifier from request
 */
export function getClientIdentifier(request: Request): string {
  // Try to get IP address from various headers
  const forwarded = request.headers.get('x-forwarded-for');
  const realIp = request.headers.get('x-real-ip');
  const cfConnectingIp = request.headers.get('cf-connecting-ip');

  // Use the first available IP
  const ip =
    forwarded?.split(',')[0]?.trim() || realIp || cfConnectingIp || 'unknown';

  return ip;
}

/**
 * Helper function to check rate limit and return appropriate response
 */
export async function checkRateLimit(
  limiter: ReturnType<typeof createRateLimiter>,
  identifier: string
): Promise<{ allowed: boolean; response?: Response }> {
  const { success, limit, remaining, reset } = await limiter.limit(identifier);

  if (!success) {
    const resetDate = new Date(reset);
    const retryAfter = Math.ceil((reset - Date.now()) / 1000);

    return {
      allowed: false,
      response: new Response(
        JSON.stringify({
          error: 'Too many requests. Please try again later.',
          retryAfter,
          resetAt: resetDate.toISOString(),
        }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'Retry-After': retryAfter.toString(),
            'X-RateLimit-Limit': limit?.toString() || '',
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': reset.toString(),
          },
        }
      ),
    };
  }

  return { allowed: true };
}
