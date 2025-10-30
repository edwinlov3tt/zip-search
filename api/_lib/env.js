const isProcessDefined = typeof process !== 'undefined';
const rawEnv = isProcessDefined ? process.env : {};

const FALLBACK_KEYS = {
  SUPABASE_URL: ['VITE_SUPABASE_URL'],
  SUPABASE_SERVICE_ROLE_KEY: ['SUPABASE_SERVICE_KEY', 'VITE_SUPABASE_SERVICE_KEY'],
  SUPABASE_ANON_KEY: ['SUPABASE_ANON_KEY', 'VITE_SUPABASE_ANON_KEY'],
  UPSTASH_REDIS_REST_URL: ['UPSTASH_REDIS_URL'],
  UPSTASH_REDIS_REST_TOKEN: ['UPSTASH_REDIS_TOKEN']
};

function resolveValue(key) {
  if (rawEnv?.[key]) return rawEnv[key];
  const fallbacks = FALLBACK_KEYS[key] || [];
  for (const alias of fallbacks) {
    if (rawEnv?.[alias]) return rawEnv[alias];
  }
  return undefined;
}

export function getEnv(key) {
  return resolveValue(key);
}

export function getRequiredEnv(key) {
  const value = resolveValue(key);
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

export const runtimeEnv = new Proxy(
  {},
  {
    get: (_, key) => resolveValue(key)
  }
);
