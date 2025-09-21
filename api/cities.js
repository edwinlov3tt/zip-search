import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const { state, county } = req.query;

    let query = supabase
      .from('zipcodes')
      .select('city')
      .not('city', 'is', null);

    if (state) {
      query = query.or(
        `state_code.eq.${state.toUpperCase()},state.ilike.${state}`
      );
    }

    if (county) {
      query = query.ilike('county', county);
    }

    const { data, error } = await query.order('city');

    if (error) throw error;

    // Remove duplicates
    const uniqueCities = Array.from(
      new Set(data.map(item => item.city))
    ).map(name => ({ name }));

    res.status(200).json(uniqueCities);
  } catch (error) {
    console.error('Cities query error:', error);
    res.status(500).json({ error: 'Failed to fetch cities' });
  }
}