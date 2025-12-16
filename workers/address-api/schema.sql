-- Address Jobs Table
-- Stores address search job status and metadata
-- Results stored in chunks (address_results table) or R2 for large datasets

CREATE TABLE IF NOT EXISTS address_jobs (
    id TEXT PRIMARY KEY,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'complete', 'failed')),
    mode TEXT NOT NULL CHECK (mode IN ('polygon', 'radius', 'zips')),
    params TEXT NOT NULL,           -- JSON of search parameters
    progress INTEGER DEFAULT 0,     -- 0-100 percentage
    total_found INTEGER DEFAULT 0,  -- Number of addresses found
    results TEXT,                   -- DEPRECATED: Use address_results table instead
    error TEXT,                     -- Error message if failed
    completed_at DATETIME,
    storage_type TEXT DEFAULT 'chunks' CHECK (storage_type IN ('chunks', 'r2', 'inline')),
    r2_key TEXT                     -- R2 object key if storage_type = 'r2'
);

-- Chunked Results Table
-- Stores address results in batches to avoid D1 timeout on large datasets
CREATE TABLE IF NOT EXISTS address_results (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    job_id TEXT NOT NULL,
    batch_number INTEGER NOT NULL,
    addresses TEXT NOT NULL,        -- JSON array of addresses (max ~1000 per batch)
    count INTEGER NOT NULL,         -- Number of addresses in this batch
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (job_id) REFERENCES address_jobs(id) ON DELETE CASCADE
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_address_jobs_status ON address_jobs(status);
CREATE INDEX IF NOT EXISTS idx_address_jobs_created ON address_jobs(created_at);
CREATE INDEX IF NOT EXISTS idx_address_results_job ON address_results(job_id);
CREATE INDEX IF NOT EXISTS idx_address_results_job_batch ON address_results(job_id, batch_number);

-- Cleanup old jobs (optional - run periodically)
-- DELETE FROM address_jobs WHERE created_at < datetime('now', '-1 day');
-- DELETE FROM address_results WHERE job_id NOT IN (SELECT id FROM address_jobs);
