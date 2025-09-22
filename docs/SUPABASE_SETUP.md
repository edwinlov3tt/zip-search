# Supabase Database Setup Instructions

## Why Supabase?
- **Free Tier**: 500MB database (perfect for 41,000 ZIP codes)
- **PostgreSQL**: Full SQL capabilities
- **Easy Setup**: 5-minute setup process
- **Vercel Compatible**: Works seamlessly with Vercel deployments

## Step 1: Create a Supabase Account

1. Go to https://supabase.com
2. Click "Start your project"
3. Sign up with GitHub (recommended) or email
4. Create a new project:
   - **Project Name**: `zip-search-db`
   - **Database Password**: Choose a strong password (save it!)
   - **Region**: Choose closest to your users
   - Click "Create new project" (takes ~2 minutes)

## Step 2: Get Your API Keys

Once your project is ready:

1. Go to **Settings** → **API** in your Supabase dashboard
2. Copy these values:
   - **Project URL**: (looks like `https://xxxxx.supabase.co`)
   - **anon public key**: (starts with `eyJ...`)
   - **service_role key**: (also starts with `eyJ...`, keep this SECRET!)

## Step 3: Set Up Environment Variables

### For Local Development

Create a `.env` file in the `api` directory:

```bash
# api/.env
SUPABASE_URL=your_project_url_here
SUPABASE_ANON_KEY=your_anon_key_here
SUPABASE_SERVICE_KEY=your_service_key_here
```

### For Vercel Deployment

1. Go to your Vercel dashboard
2. Select your project
3. Go to **Settings** → **Environment Variables**
4. Add these variables:
   - `SUPABASE_URL` = your project URL
   - `SUPABASE_ANON_KEY` = your anon key
   - `SUPABASE_SERVICE_KEY` = your service key (mark as sensitive)

## Step 4: Create the Database Table

### Option A: Using the Setup Script (Recommended)

```bash
cd api
node setup-supabase.js
```

### Option B: Manual Setup in Supabase Dashboard

1. Go to your Supabase dashboard
2. Click on **SQL Editor**
3. Run this SQL:

```sql
CREATE TABLE zipcodes (
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

-- Create indexes for performance
CREATE INDEX idx_zipcode ON zipcodes(zipcode);
CREATE INDEX idx_city ON zipcodes(LOWER(city));
CREATE INDEX idx_state ON zipcodes(state_code);
CREATE INDEX idx_county ON zipcodes(LOWER(county));
```

4. After creating the table, run the setup script to import data:
```bash
node setup-supabase.js
```

## Step 5: Test Locally

```bash
# Start the API server
cd api
npm start

# Test the health endpoint
curl http://localhost:3001/api/health
```

You should see:
```json
{
  "status": "OK",
  "database": "connected",
  "provider": "Supabase",
  "totalZipCodes": 41706
}
```

## Step 6: Deploy to Vercel

```bash
git add .
git commit -m "Switch to Supabase database"
git push
```

## Troubleshooting

### "Missing Supabase credentials" Error
- Make sure environment variables are set correctly
- For Vercel: Check Settings → Environment Variables
- For local: Check `.env` file exists in `api` directory

### "Table does not exist" Error
- Run the SQL command in Step 4 to create the table
- Make sure you're in the correct Supabase project

### Import Takes Too Long
- The script imports in batches of 500 records
- Full import of 41,000+ records takes about 2-3 minutes
- Check Supabase dashboard for rate limits if errors occur

### CORS Issues
- The API already has CORS configured for all origins
- If issues persist, check Supabase dashboard → Authentication → URL Configuration

## Monitoring Your Database

1. Go to your Supabase dashboard
2. Click on **Table Editor** to view your data
3. Use **SQL Editor** to run queries
4. Check **Database** tab for usage metrics

## Free Tier Limits

Supabase free tier includes:
- 500 MB database space (ZIP data uses ~10MB)
- 2 GB bandwidth
- 50,000 monthly active users
- Unlimited API requests

Perfect for this application!

## Support

- Supabase Docs: https://supabase.com/docs
- Status Page: https://status.supabase.com
- Discord Community: https://discord.supabase.com