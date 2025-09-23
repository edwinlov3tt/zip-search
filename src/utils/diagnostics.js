import { ZipCodeService } from '../services/zipCodeService';
import supabaseService from '../services/supabaseService';

function redact(url) {
  try { return new URL(url).host; } catch { return undefined; }
}

export async function runStartupDiagnostics() {
  const env = import.meta.env || {};
  const info = {
    VITE_API_URL: Boolean(env.VITE_API_URL),
    VITE_GEO_API_BASE: Boolean(env.VITE_GEO_API_BASE),
    VITE_SUPABASE_URL: Boolean(env.VITE_SUPABASE_URL),
    VITE_SUPABASE_ANON_KEY: Boolean(env.VITE_SUPABASE_ANON_KEY),
    VITE_MAPBOX_TOKEN: Boolean(env.VITE_MAPBOX_TOKEN || env.VITE_MAPBOX_ACCESS_TOKEN),
    apiHost: env.VITE_API_URL ? redact(env.VITE_API_URL) : undefined,
    geoHost: env.VITE_GEO_API_BASE ? redact(/^https?:\/\//.test(env.VITE_GEO_API_BASE) ? env.VITE_GEO_API_BASE : `https://${env.VITE_GEO_API_BASE}`) : undefined,
    mode: env.MODE || (env.DEV ? 'development' : 'production')
  };

  console.groupCollapsed('%c[Diagnostics] startup', 'color:#2563EB');
  console.log('env', info);

  try {
    const sbOk = await supabaseService.checkHealth();
    console.log('supabase.health', sbOk);
  } catch (e) {
    console.warn('supabase.health error', e);
  }

  try {
    const api = await ZipCodeService.health();
    console.log('api.health', api);
  } catch (e) {
    console.warn('api.health error', e);
  }

  console.groupEnd();
}

