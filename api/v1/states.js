import { createClient } from '@supabase/supabase-js';
import { getEnv } from '../_lib/env.js';
import { getStaticStates, isStaticZipDataAvailable } from '../_lib/static-zip-data.js';

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

async function fetchStatesFromSupabase() {
  const supabaseUrl = getEnv('SUPABASE_URL');
  const serviceRoleKey = getEnv('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !serviceRoleKey) {
    return null;
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const { data, error } = await supabase
    .from('zipcodes')
    .select('state, state_code')
    .order('state');

  if (error) {
    throw new Error(error.message);
  }

  const statesMap = new Map();
  data.forEach((row) => {
    const stateName = row.state;
    if (!stateName) return;
    if (!statesMap.has(stateName)) {
      statesMap.set(stateName, {
        name: stateName,
        code: row.state_code || stateName.substring(0, 2).toUpperCase()
      });
    }
  });

  return Array.from(statesMap.values()).sort((a, b) => a.name.localeCompare(b.name));
}

export default async function handler(req, res) {
  applyCors(res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const states = await fetchStatesFromSupabase();
    if (states && states.length > 0) {
      return res.status(200).json(states);
    }

    if (await isStaticZipDataAvailable()) {
      const fallbackStates = await getStaticStates();
      return res.status(200).json(fallbackStates);
    }

    return res.status(503).json({
      error: 'ZIP data unavailable',
      details: 'Supabase credentials missing and static fallback not accessible'
    });
  } catch (error) {
    console.error('[api] states handler error', error);

    if (await isStaticZipDataAvailable()) {
      const fallbackStates = await getStaticStates();
      return res.status(200).json(fallbackStates);
    }

    return res.status(500).json({
      error: 'Failed to fetch states',
      details: error.message
    });
  }
}
