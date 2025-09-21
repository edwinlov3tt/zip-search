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
    // Query the spatial table directly for states
    const { data, error } = await supabase
      .from('zipcodes_spatial')
      .select('state_code, state')
      .not('state_code', 'is', null)
      .not('state', 'is', null)
      .neq('state_code', '')
      .neq('state', '')
      .order('state');

    if (error) throw error;

    // Remove duplicates using Map to ensure unique state_codes
    const stateMap = new Map();

    data.forEach(item => {
      if (item.state_code && item.state && !stateMap.has(item.state_code)) {
        stateMap.set(item.state_code, {
          code: item.state_code,
          name: item.state
        });
      }
    });

    const uniqueStates = Array.from(stateMap.values()).sort((a, b) =>
      a.name.localeCompare(b.name)
    );

    console.log(`Found ${uniqueStates.length} unique states`);

    res.status(200).json(uniqueStates);
  } catch (error) {
    console.error('States query error:', error);
    res.status(500).json({ error: 'Failed to fetch states', details: error.message });
  }
}