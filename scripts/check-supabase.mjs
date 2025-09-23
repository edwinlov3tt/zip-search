#!/usr/bin/env node
// Quick Supabase connectivity check using env vars.
// Reads VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY from .env if not present.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function loadDotEnv() {
  const envPath = path.resolve(__dirname, '..', '.env');
  try {
    const text = fs.readFileSync(envPath, 'utf8');
    for (const line of text.split(/\r?\n/)) {
      if (!line || line.trim().startsWith('#')) continue;
      const idx = line.indexOf('=');
      if (idx === -1) continue;
      const key = line.slice(0, idx).trim();
      let val = line.slice(idx + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (!(key in process.env)) process.env[key] = val;
    }
  } catch (_) {
    // ignore missing .env
  }
}

if (!process.env.VITE_SUPABASE_URL || !process.env.VITE_SUPABASE_ANON_KEY) {
  loadDotEnv();
}

const url = process.env.VITE_SUPABASE_URL;
const anon = process.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anon) {
  console.error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY');
  process.exit(2);
}

const supabase = createClient(url, anon);

try {
  const start = Date.now();
  const { data, error } = await supabase.from('zipcodes').select('zipcode').limit(1);
  const ms = Date.now() - start;
  if (error) {
    console.error('Supabase error:', error.message || error);
    process.exit(1);
  }
  console.log('Supabase OK:', {
    rows: (data && data.length) || 0,
    time_ms: ms,
  });
  process.exit(0);
} catch (e) {
  console.error('Supabase request failed:', e.message || e);
  process.exit(1);
}

