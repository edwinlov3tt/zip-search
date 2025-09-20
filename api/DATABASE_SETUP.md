# Database Setup Instructions

## Setting up Vercel Postgres

### 1. Connect Your Project to Vercel Postgres

1. Go to your Vercel dashboard: https://vercel.com/dashboard
2. Select your `zip-search` project
3. Go to the "Storage" tab
4. Click "Connect Database" → "Create New" → "Postgres"
5. Give your database a name (e.g., "zip-search-db")
6. Select a region close to your deployment
7. Click "Create & Continue"

### 2. Get Database Connection Details

After creating the database, Vercel will show you the connection details. These will be automatically added as environment variables to your project:

- `POSTGRES_URL`
- `POSTGRES_PRISMA_URL`
- `POSTGRES_URL_NON_POOLING`
- `POSTGRES_USER`
- `POSTGRES_HOST`
- `POSTGRES_PASSWORD`
- `POSTGRES_DATABASE`

### 3. Set Up Local Development Environment

For local development, you need to pull these environment variables:

```bash
# Install Vercel CLI if you haven't already
npm i -g vercel

# Link your local project to Vercel
vercel link

# Pull the environment variables
vercel env pull .env.local
```

### 4. Initialize the Database

Run the setup script to create tables and import data:

```bash
cd api
node setup-database.js
```

This script will:
- Create the `zipcodes` table with proper schema
- Create indexes for faster queries
- Import all ZIP code data from the CSV file
- Show progress as it imports (41,000+ records)

### 5. Verify the Setup

Check that the database is working:

```bash
# Test the API locally
npm start

# In another terminal, test the health endpoint
curl http://localhost:3001/api/health
```

You should see a response like:
```json
{
  "status": "OK",
  "database": "connected",
  "totalZipCodes": 41706,
  "timestamp": "2025-09-20T..."
}
```

### 6. Deploy the Changes

Push the changes to deploy the new database-backed API:

```bash
git add .
git commit -m "Switch to Vercel Postgres database"
git push
```

Vercel will automatically deploy the changes.

## Troubleshooting

### Database Connection Issues

If you get connection errors:
1. Check that environment variables are set: `vercel env ls`
2. Ensure your database is in the same region as your deployment
3. Check the Vercel dashboard for any database status issues

### Data Import Issues

If the setup script fails:
1. Check that the CSV file exists at `api/zipcodes.us.csv`
2. Ensure you have proper database permissions
3. Try running with more detailed logging:
   ```bash
   DEBUG=* node setup-database.js
   ```

### Performance Optimization

The database includes these indexes for optimal performance:
- `idx_zipcode` - Fast ZIP code lookups
- `idx_city` - Fast city searches (case-insensitive)
- `idx_state` - Fast state filtering
- `idx_county` - Fast county searches (case-insensitive)

## API Endpoints

The Postgres-backed API supports:
- `/api/search` - Search with various filters
- `/api/states` - Get all states
- `/api/counties` - Get counties (optionally by state)
- `/api/cities` - Get cities (optionally by state/county)
- `/api/zipcode/:zip` - Get specific ZIP code details
- `/api/health` - Check database connection status