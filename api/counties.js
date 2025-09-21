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
    const { state } = req.query;

    let query = supabase
      .from('zipcodes')
      .select('county')
      .not('county', 'is', null);

    if (state) {
      query = query.or(
        `state_code.eq.${state.toUpperCase()},state.ilike.${state}`
      );
    }

    const { data, error } = await query.order('county');

    if (error) throw error;

    // Remove duplicates
    const uniqueCounties = Array.from(
      new Set(data.map(item => item.county))
    ).map(name => ({ name }));

    res.status(200).json(uniqueCounties);
  } catch (error) {
    console.error('Counties query error:', error);
    res.status(500).json({ error: 'Failed to fetch counties' });
  }
}