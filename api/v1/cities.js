import { createClient } from '@supabase/supabase-js';
import { getEnv } from '../_lib/env.js';
import { getStaticCities, isStaticZipDataAvailable } from '../_lib/static-zip-data.js';

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

async function fetchCitiesFromSupabase(state, county) {
  const supabaseUrl = getEnv('SUPABASE_URL');
  const serviceRoleKey = getEnv('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !serviceRoleKey) {
    return null;
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  let query = supabase
    .from('zipcodes')
    .select('city')
    .eq('state', state)
    .order('city');

  if (county) {
    query = query.eq('county', county);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  const citiesSet = new Set();
  data.forEach((row) => {
    if (row.city) {
      citiesSet.add(row.city);
    }
  });

  return Array.from(citiesSet).sort().map((name) => ({ name }));
}

export default async function handler(req, res) {
  applyCors(res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { state, county } = req.query;

  if (!state) {
    return res.status(400).json({ error: 'State parameter is required' });
  }

  try {
    const cities = await fetchCitiesFromSupabase(state, county);
    if (cities && cities.length > 0) {
      return res.status(200).json(cities);
    }

    if (await isStaticZipDataAvailable()) {
      const fallback = await getStaticCities(state, county);
      return res.status(200).json(fallback);
    }

    return res.status(503).json({
      error: 'ZIP data unavailable',
      details: 'Supabase credentials missing and static fallback not accessible'
    });
  } catch (error) {
    console.error('[api] cities handler error', error);

    if (await isStaticZipDataAvailable()) {
      const fallback = await getStaticCities(state, county);
      return res.status(200).json(fallback);
    }

    return res.status(500).json({
      error: 'Failed to fetch cities',
      details: error.message
    });
  }
}
