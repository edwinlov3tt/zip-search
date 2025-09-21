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
    const { data, error } = await supabase
      .from('zipcodes')
      .select('state_code, state')
      .not('state_code', 'is', null)
      .order('state');

    if (error) throw error;

    // Remove duplicates
    const uniqueStates = Array.from(
      new Map(data.map(item => [item.state_code, {
        code: item.state_code,
        name: item.state
      }])).values()
    );

    res.status(200).json(uniqueStates);
  } catch (error) {
    console.error('States query error:', error);
    res.status(500).json({ error: 'Failed to fetch states' });
  }
}