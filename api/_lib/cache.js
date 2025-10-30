import { Redis } from '@upstash/redis';
import { getEnv } from './env.js';

let cachedRedisClient;

function getRedisClient() {
  if (cachedRedisClient) return cachedRedisClient;

  const url = getEnv('UPSTASH_REDIS_REST_URL');
  const token = getEnv('UPSTASH_REDIS_REST_TOKEN');

  if (!url || !token) {
    return null;
  }

  cachedRedisClient = new Redis({ url, token });
  return cachedRedisClient;
}

export async function getCachedJSON(key) {
  const client = getRedisClient();
  if (!client) return null;

  try {
    const raw = await client.get(key);
    if (!raw) return null;
    if (typeof raw === 'string') {
      try {
        return JSON.parse(raw);
      } catch (error) {
        return null;
      }
    }
    return raw;
  } catch (error) {
    console.error('Redis cache read failure', error);
    return null;
  }
}

export async function setCachedJSON(key, value, ttlSeconds = 120) {
  const client = getRedisClient();
  if (!client) return;

  try {
    const payload = typeof value === 'string' ? value : JSON.stringify(value);
    await client.set(key, payload, {
      ex: ttlSeconds
    });
  } catch (error) {
    console.error('Redis cache write failure', error);
  }
}
