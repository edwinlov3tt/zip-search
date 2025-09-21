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
    // Use materialized view for instant results (if available)
    // Otherwise fallback to spatial table
    let { data, error } = await supabase
      .from('states_view')
      .select('code, name');

    // If view doesn't exist, query the spatial table
    if (error || !data) {
      console.log('Using fallback query for states');
      const result = await supabase
        .from('zipcodes_spatial')
        .select('state_code, state')
        .not('state_code', 'is', null)
        .not('state', 'is', null)
        .neq('state_code', '')
        .neq('state', '')
        .order('state');

      data = result.data;
      error = result.error;
    }

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