const { sql } = require('@vercel/postgres');
const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');

async function setupDatabase() {
  console.log('🚀 Setting up Vercel Postgres database...');

  try {
    // Create the zipcodes table
    console.log('Creating zipcodes table...');
    await sql`
      CREATE TABLE IF NOT EXISTS zipcodes (
        id SERIAL PRIMARY KEY,
        zipcode VARCHAR(10) NOT NULL,
        city VARCHAR(100),
        state VARCHAR(50),
        state_code VARCHAR(2),
        county VARCHAR(100),
        county_code VARCHAR(10),
        latitude DECIMAL(10, 6),
        longitude DECIMAL(10, 6),
        UNIQUE(zipcode)
      )
    `;

    // Create indexes for faster searches
    console.log('Creating indexes...');
    await sql`CREATE INDEX IF NOT EXISTS idx_zipcode ON zipcodes(zipcode)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_city ON zipcodes(LOWER(city))`;
    await sql`CREATE INDEX IF NOT EXISTS idx_state ON zipcodes(state_code)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_county ON zipcodes(LOWER(county))`;

    // Check if data already exists
    const { rowCount } = await sql`SELECT COUNT(*) as count FROM zipcodes`;
    if (rowCount > 0) {
      console.log(`✅ Database already has ${rowCount} zipcodes`);
      return;
    }

    // Load and parse CSV data
    console.log('Loading CSV data...');
    const csvPath = path.join(__dirname, 'zipcodes.us.csv');
    const csvData = fs.readFileSync(csvPath, 'utf-8');
    const records = parse(csvData, {
      columns: true,
      skip_empty_lines: true
    });

    console.log(`Parsed ${records.length} records from CSV`);

    // Insert data in batches
    const batchSize = 100;
    for (let i = 0; i < records.length; i += batchSize) {
      const batch = records.slice(i, i + batchSize);

      // Build values for batch insert
      const values = batch.map(record => {
        return `(
          '${record.zipcode}',
          '${record.place.replace(/'/g, "''")}',
          '${record.state.replace(/'/g, "''")}',
          '${record.state_code}',
          '${record.county.replace(/'/g, "''")}',
          '${record.county_code}',
          ${parseFloat(record.latitude)},
          ${parseFloat(record.longitude)}
        )`;
      }).join(',');

      await sql.query(`
        INSERT INTO zipcodes (zipcode, city, state, state_code, county, county_code, latitude, longitude)
        VALUES ${values}
        ON CONFLICT (zipcode) DO NOTHING
      `);

      if (i % 1000 === 0) {
        console.log(`Inserted ${i} records...`);
      }
    }

    console.log('✅ Database setup complete!');

    // Verify the data
    const { rows } = await sql`SELECT COUNT(*) as count FROM zipcodes`;
    console.log(`Total zipcodes in database: ${rows[0].count}`);

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