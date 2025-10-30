import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { getEnv } from './env.js';

let rateLimiter;

function buildRateLimiter() {
  const url = getEnv('UPSTASH_REDIS_REST_URL');
  const token = getEnv('UPSTASH_REDIS_REST_TOKEN');

  if (!url || !token) {
    return null;
  }

  const redis = new Redis({ url, token });

  return new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(120, '5 m'),
    prefix: 'zip-search:rate-limit'
  });
}

export async function enforceRateLimit(identifier) {
  if (!rateLimiter) {
    rateLimiter = buildRateLimiter();
  }

  if (!rateLimiter) {
    return { success: true };
  }

  try {
    return await rateLimiter.limit(identifier);
  } catch (error) {
    console.error('Rate limit enforcement failed', error);
    return { success: true };
  }
}
