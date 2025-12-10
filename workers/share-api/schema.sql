-- GeoSearch Shares Database Schema
-- Stores shared search states for short URL sharing

CREATE TABLE IF NOT EXISTS shares (
    id TEXT PRIMARY KEY,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    view_mode TEXT DEFAULT 'edit' CHECK (view_mode IN ('edit', 'view')),
    search_mode TEXT NOT NULL,

    -- Map view state
    map_center_lat REAL,
    map_center_lng REAL,
    map_zoom INTEGER,
    map_type TEXT DEFAULT 'street',

    -- Full search data as JSON (flexible for all search modes)
    search_data TEXT NOT NULL,

    -- Optional metadata
    title TEXT,
    description TEXT,

    -- Optional expiration
    expires_at DATETIME,

    -- Usage tracking
    view_count INTEGER DEFAULT 0,
    last_viewed_at DATETIME
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_shares_created_at ON shares(created_at);
CREATE INDEX IF NOT EXISTS idx_shares_expires_at ON shares(expires_at);
