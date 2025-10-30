import { createClient } from '@supabase/supabase-js';
import { getEnv } from '../_lib/env.js';
import { getStaticCounties, isStaticZipDataAvailable } from '../_lib/static-zip-data.js';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Environment',
  'Content-Type': 'application/json'
};

function applyCors(res) {
  Object.entries(corsHeaders).forEach(([key, value]) => {
    res.setHeader(key, value);
  });
}

async function fetchCountiesFromSupabase(state) {
  const supabaseUrl = getEnv('SUPABASE_URL');
  const serviceRoleKey = getEnv('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !serviceRoleKey) {
    return null;
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const { data, error } = await supabase
    .from('zipcodes')
    .select('county')
    .eq('state', state)
    .order('county');

  if (error) {
    throw new Error(error.message);
  }

  const countiesSet = new Set();
  data.forEach((row) => {
    if (row.county) {
      countiesSet.add(row.county);
    }
  });

  return Array.from(countiesSet).sort().map((name) => ({ name }));
}

export default async function handler(req, res) {
  applyCors(res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { state } = req.query;
  if (!state) {
    return res.status(400).json({ error: 'State parameter is required' });
  }

  try {
    const counties = await fetchCountiesFromSupabase(state);
    if (counties && counties.length > 0) {
      return res.status(200).json(counties);
    }

    if (await isStaticZipDataAvailable()) {
      const fallback = await getStaticCounties(state);
      return res.status(200).json(fallback);
    }

    return res.status(503).json({
      error: 'ZIP data unavailable',
      details: 'Supabase credentials missing and static fallback not accessible'
    });
  } catch (error) {
    console.error('[api] counties handler error', error);

    if (await isStaticZipDataAvailable()) {
      const fallback = await getStaticCounties(state);
      return res.status(200).json(fallback);
    }

    return res.status(500).json({
      error: 'Failed to fetch counties',
      details: error.message
    });
  }
}
