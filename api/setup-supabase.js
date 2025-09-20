const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');

// You'll need to set these environment variables
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY; // Use service key or anon key

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials!');
  console.log('\nPlease set these environment variables:');
  console.log('  SUPABASE_URL=your_supabase_url');
  console.log('  SUPABASE_SERVICE_KEY=your_service_key');
  console.log('\nYou can find these in your Supabase dashboard:');
  console.log('  1. Go to https://supabase.com/dashboard');
  console.log('  2. Select your project');
  console.log('  3. Go to Settings > API');
  console.log('  4. Copy the URL and service_role key');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function setupDatabase() {
  console.log('🚀 Setting up Supabase database...');

  try {
    // First check if table exists by trying to query it
    console.log('Checking if table exists...');
    const { data: testData, error: testError } = await supabase
      .from('zipcodes')
      .select('zipcode')
      .limit(1);

    if (testError && testError.code === '42P01') {
      // Table doesn't exist
      console.log('\n⚠️  Table does not exist yet!');
      console.log('\nPlease create the table in Supabase:');
      console.log('1. Go to your Supabase dashboard');
      console.log('2. Click on "SQL Editor"');
      console.log('3. Run this SQL:\n');
      console.log(`CREATE TABLE zipcodes (
  id SERIAL PRIMARY KEY,
  zipcode VARCHAR(10) NOT NULL UNIQUE,
  city VARCHAR(100),
  state VARCHAR(50),
  state_code VARCHAR(2),
  county VARCHAR(100),
  county_code VARCHAR(10),
  latitude DECIMAL(10, 6),
  longitude DECIMAL(10, 6)
);

CREATE INDEX idx_zipcode ON zipcodes(zipcode);
CREATE INDEX idx_city ON zipcodes(LOWER(city));
CREATE INDEX idx_state ON zipcodes(state_code);
CREATE INDEX idx_county ON zipcodes(LOWER(county));`);
      console.log('\n4. Then run this script again to import the data.');
      process.exit(1);
    }

    // Check if data already exists
    const { data: existingData, count } = await supabase
      .from('zipcodes')
      .select('*', { count: 'exact', head: true });

    if (count && count > 0) {
      console.log(`✅ Database already has ${count} zipcodes`);
      return;
    }

    // Load and parse CSV data
    console.log('Loading CSV data...');
    const csvPath = path.join(__dirname, 'zipcodes.us.csv');

    if (!fs.existsSync(csvPath)) {
      console.error(`❌ CSV file not found at: ${csvPath}`);
      console.log('Please ensure zipcodes.us.csv is in the api directory');
      process.exit(1);
    }

    const csvData = fs.readFileSync(csvPath, 'utf-8');
    const records = parse(csvData, {
      columns: true,
      skip_empty_lines: true
    });

    console.log(`Parsed ${records.length} records from CSV`);

    // Transform and prepare data for insertion
    const transformedRecords = records.map(record => ({
      zipcode: record.zipcode,
      city: record.place || record.city,
      state: record.state,
      state_code: record.state_code,
      county: record.province || record.county,
      county_code: record.province_code || record.county_code,
      latitude: parseFloat(record.latitude),
      longitude: parseFloat(record.longitude)
    }));

    // Insert data in batches (Supabase has a limit on bulk inserts)
    const batchSize = 500; // Supabase handles larger batches well
    let totalInserted = 0;

    for (let i = 0; i < transformedRecords.length; i += batchSize) {
      const batch = transformedRecords.slice(i, i + batchSize);

      const { error: insertError } = await supabase
        .from('zipcodes')
        .upsert(batch, { onConflict: 'zipcode' });

      if (insertError) {
        console.error('Insert error:', insertError);
        throw insertError;
      }

      totalInserted += batch.length;
      console.log(`Inserted ${totalInserted} / ${transformedRecords.length} records...`);
    }

    console.log('✅ Database setup complete!');

    // Verify the data
    const { count: finalCount } = await supabase
      .from('zipcodes')
      .select('*', { count: 'exact', head: true });

    console.log(`Total zipcodes in database: ${finalCount}`);

  } catch (error) {
    console.error('Database setup failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  setupDatabase().then(() => {
    console.log('Setup complete!');
    process.exit(0);
  });
}

module.exports = { setupDatabase };