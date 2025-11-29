-- =====================================================
-- SQLite Database Migration Script
-- うちなーらいふ不動産スクレイピングシステム
-- =====================================================

-- Drop existing tables if they exist
DROP TABLE IF EXISTS property_snapshots;
DROP TABLE IF EXISTS daily_link_snapshots;
DROP TABLE IF EXISTS properties;

-- =====================================================
-- Table 1: properties
-- Purpose: Current active property listings
-- =====================================================
CREATE TABLE properties (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  
  -- Core identifiers
  url TEXT UNIQUE NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('jukyo', 'jigyo', 'yard', 'parking', 'tochi', 'mansion', 'house', 'sonota')),
  category_type TEXT NOT NULL CHECK (category_type IN ('賃貸', '売買')),
  category_name_ja TEXT NOT NULL,
  genre_name_ja TEXT NOT NULL,
  
  -- Common fixed fields
  title TEXT,
  price TEXT,
  favorites INTEGER DEFAULT 0,
  update_date DATE,
  expiry_date DATE,
  scraped_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  -- Images (JSON array stored as TEXT)
  images TEXT, -- JSON array: ["url1", "url2", ...]
  
  -- Company info
  company_name TEXT,
  
  -- Flexible property data (JSON for varying columns)
  property_data TEXT DEFAULT '{}', -- JSON object
  
  -- Status tracking
  is_active INTEGER DEFAULT 1 CHECK (is_active IN (0, 1)),
  first_seen_date DATE DEFAULT (date('now')),
  last_seen_date DATE DEFAULT (date('now')),
  
  -- Timestamps
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX idx_properties_category ON properties(category);
CREATE INDEX idx_properties_category_type ON properties(category_type);
CREATE INDEX idx_properties_is_active ON properties(is_active);
CREATE INDEX idx_properties_first_seen ON properties(first_seen_date DESC);
CREATE INDEX idx_properties_last_seen ON properties(last_seen_date DESC);
CREATE INDEX idx_properties_url ON properties(url);
CREATE INDEX idx_properties_created_at ON properties(created_at DESC);

-- =====================================================
-- Table 2: daily_link_snapshots
-- Purpose: Daily snapshots of all property URLs
-- =====================================================
CREATE TABLE daily_link_snapshots (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  
  snapshot_date DATE NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('jukyo', 'jigyo', 'yard', 'parking', 'tochi', 'mansion', 'house', 'sonota')),
  
  -- Array of URLs (stored as JSON)
  urls TEXT NOT NULL, -- JSON array
  url_count INTEGER NOT NULL,
  
  -- Metadata
  scraped_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  -- Unique constraint
  UNIQUE(snapshot_date, category)
);

-- Indexes
CREATE INDEX idx_daily_snapshots_date ON daily_link_snapshots(snapshot_date DESC);
CREATE INDEX idx_daily_snapshots_category ON daily_link_snapshots(category);

-- =====================================================
-- Table 3: property_snapshots (Optional)
-- Purpose: Historical snapshots of property details
-- =====================================================
CREATE TABLE property_snapshots (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  
  property_id TEXT NOT NULL,
  snapshot_date DATE NOT NULL,
  
  -- Snapshot data
  price TEXT,
  property_data TEXT DEFAULT '{}', -- JSON object
  
  -- Timestamps
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  -- Foreign key
  FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE,
  
  -- Unique constraint
  UNIQUE(property_id, snapshot_date)
);

-- Indexes
CREATE INDEX idx_property_snapshots_property ON property_snapshots(property_id);
CREATE INDEX idx_property_snapshots_date ON property_snapshots(snapshot_date DESC);

-- =====================================================
-- Triggers
-- =====================================================

-- Auto-update updated_at timestamp on properties
CREATE TRIGGER update_properties_updated_at
  AFTER UPDATE ON properties
  FOR EACH ROW
BEGIN
  UPDATE properties SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- =====================================================
-- Migration Complete
-- =====================================================
