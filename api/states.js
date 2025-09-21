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
    // Use RPC to get distinct states efficiently
    const { data: rpcData, error: rpcError } = await supabase
      .rpc('get_distinct_states');

    if (!rpcError && rpcData) {
      // RPC function exists and returned data
      const uniqueStates = rpcData
        .filter(item => item.state_code && item.state)
        .map(item => ({
          code: item.state_code,
          name: item.state
        }))
        .sort((a, b) => a.name.localeCompare(b.name));

      console.log(`Found ${uniqueStates.length} states via RPC`);
      return res.status(200).json(uniqueStates);
    }

    // Fallback: If RPC doesn't exist, use a limited query approach
    console.log('RPC not available, using fallback query');

    // Get a sample of records to extract unique states
    // This is more efficient than loading all 41k records
    const { data, error } = await supabase
      .from('zipcodes_spatial')
      .select('state_code, state')
      .not('state_code', 'is', null)
      .not('state', 'is', null)
      .neq('state_code', '')
      .neq('state', '')
      .limit(5000); // Limit to reduce payload

    if (error) throw error;

    // Remove duplicates using Map
    const stateMap = new Map();

    data.forEach(item => {
      if (item.state_code && item.state && !stateMap.has(item.state_code)) {
        stateMap.set(item.state_code, {
          code: item.state_code,
          name: item.state
        });
      }
    });

    // If we don't have all states, try a different approach
    if (stateMap.size < 50) {
      // Hardcoded fallback for US states
      const US_STATES = [
        { code: 'AL', name: 'Alabama' },
        { code: 'AK', name: 'Alaska' },
        { code: 'AZ', name: 'Arizona' },
        { code: 'AR', name: 'Arkansas' },
        { code: 'CA', name: 'California' },
        { code: 'CO', name: 'Colorado' },
        { code: 'CT', name: 'Connecticut' },
        { code: 'DE', name: 'Delaware' },
        { code: 'DC', name: 'District of Columbia' },
        { code: 'FL', name: 'Florida' },
        { code: 'GA', name: 'Georgia' },
        { code: 'HI', name: 'Hawaii' },
        { code: 'ID', name: 'Idaho' },
        { code: 'IL', name: 'Illinois' },
        { code: 'IN', name: 'Indiana' },
        { code: 'IA', name: 'Iowa' },
        { code: 'KS', name: 'Kansas' },
        { code: 'KY', name: 'Kentucky' },
        { code: 'LA', name: 'Louisiana' },
        { code: 'ME', name: 'Maine' },
        { code: 'MD', name: 'Maryland' },
        { code: 'MA', name: 'Massachusetts' },
        { code: 'MI', name: 'Michigan' },
        { code: 'MN', name: 'Minnesota' },
        { code: 'MS', name: 'Mississippi' },
        { code: 'MO', name: 'Missouri' },
        { code: 'MT', name: 'Montana' },
        { code: 'NE', name: 'Nebraska' },
        { code: 'NV', name: 'Nevada' },
        { code: 'NH', name: 'New Hampshire' },
        { code: 'NJ', name: 'New Jersey' },
        { code: 'NM', name: 'New Mexico' },
        { code: 'NY', name: 'New York' },
        { code: 'NC', name: 'North Carolina' },
        { code: 'ND', name: 'North Dakota' },
        { code: 'OH', name: 'Ohio' },
        { code: 'OK', name: 'Oklahoma' },
        { code: 'OR', name: 'Oregon' },
        { code: 'PA', name: 'Pennsylvania' },
        { code: 'RI', name: 'Rhode Island' },
        { code: 'SC', name: 'South Carolina' },
        { code: 'SD', name: 'South Dakota' },
        { code: 'TN', name: 'Tennessee' },
        { code: 'TX', name: 'Texas' },
        { code: 'UT', name: 'Utah' },
        { code: 'VT', name: 'Vermont' },
        { code: 'VA', name: 'Virginia' },
        { code: 'WA', name: 'Washington' },
        { code: 'WV', name: 'West Virginia' },
        { code: 'WI', name: 'Wisconsin' },
        { code: 'WY', name: 'Wyoming' }
      ];

      console.log('Using hardcoded states list as fallback');
      return res.status(200).json(US_STATES);
    }

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