-- =====================================================
-- Supabase Database Migration Script
-- うちなーらいふ不動産スクレイピングシステム
-- =====================================================

-- Drop existing tables if they exist (for clean migration)
DROP TABLE IF EXISTS property_snapshots CASCADE;
DROP TABLE IF EXISTS daily_link_snapshots CASCADE;
DROP TABLE IF EXISTS properties CASCADE;

-- =====================================================
-- Table 1: properties
-- Purpose: Current active property listings
-- =====================================================
CREATE TABLE properties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Core identifiers
  url TEXT UNIQUE NOT NULL,
  category TEXT NOT NULL, -- 'jukyo', 'tochi', etc.
  category_type TEXT NOT NULL, -- '賃貸' or '売買'
  category_name_ja TEXT NOT NULL, -- e.g., '賃貸', '売買'
  genre_name_ja TEXT NOT NULL, -- e.g., '住居', '土地'
  
  -- Common fixed fields
  title TEXT,
  price TEXT,
  favorites INTEGER DEFAULT 0,
  update_date DATE,
  expiry_date DATE,
  scraped_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Images (array of URLs)
  images TEXT[],
  
  -- Company info
  company_name TEXT,
  
  -- Flexible property data (JSONB for varying columns)
  -- This stores all category-specific fields like 家賃, 敷金, 間取り, etc.
  property_data JSONB DEFAULT '{}'::jsonb,
  
  -- Status tracking
  is_active BOOLEAN DEFAULT true,
  first_seen_date DATE DEFAULT CURRENT_DATE,
  last_seen_date DATE DEFAULT CURRENT_DATE,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraint: validate category values
  CONSTRAINT properties_category_check CHECK (
    category IN ('jukyo', 'jigyo', 'yard', 'parking', 'tochi', 'mansion', 'house', 'sonota')
  ),
  CONSTRAINT properties_category_type_check CHECK (
    category_type IN ('賃貸', '売買')
  )
);

-- Indexes for performance
CREATE INDEX idx_properties_category ON properties(category);
CREATE INDEX idx_properties_category_type ON properties(category_type);
CREATE INDEX idx_properties_is_active ON properties(is_active);
CREATE INDEX idx_properties_first_seen ON properties(first_seen_date DESC);
CREATE INDEX idx_properties_last_seen ON properties(last_seen_date DESC);
CREATE INDEX idx_properties_property_data ON properties USING GIN (property_data);
CREATE INDEX idx_properties_url_hash ON properties USING HASH (url);
CREATE INDEX idx_properties_created_at ON properties(created_at DESC);

-- =====================================================
-- Table 2: daily_link_snapshots
-- Purpose: Daily snapshots of all property URLs
-- =====================================================
CREATE TABLE daily_link_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  snapshot_date DATE NOT NULL,
  category TEXT NOT NULL,
  
  -- Array of URLs found on this date
  urls TEXT[] NOT NULL,
  url_count INTEGER NOT NULL,
  
  -- Metadata
  scraped_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Unique constraint: one snapshot per category per day
  CONSTRAINT daily_link_snapshots_unique UNIQUE (snapshot_date, category),
  
  -- Constraint: validate category
  CONSTRAINT daily_link_snapshots_category_check CHECK (
    category IN ('jukyo', 'jigyo', 'yard', 'parking', 'tochi', 'mansion', 'house', 'sonota')
  )
);

-- Indexes
CREATE INDEX idx_daily_snapshots_date ON daily_link_snapshots(snapshot_date DESC);
CREATE INDEX idx_daily_snapshots_category ON daily_link_snapshots(category);

-- =====================================================
-- Table 3: property_snapshots (Optional)
-- Purpose: Historical snapshots of property details
-- =====================================================
CREATE TABLE property_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  property_id UUID REFERENCES properties(id) ON DELETE CASCADE,
  snapshot_date DATE NOT NULL,
  
  -- Snapshot data
  price TEXT,
  property_data JSONB DEFAULT '{}'::jsonb,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Unique: one snapshot per property per day
  CONSTRAINT property_snapshots_unique UNIQUE (property_id, snapshot_date)
);

-- Indexes
CREATE INDEX idx_property_snapshots_property ON property_snapshots(property_id);
CREATE INDEX idx_property_snapshots_date ON property_snapshots(snapshot_date DESC);

-- =====================================================
-- Triggers
-- =====================================================

-- Auto-update updated_at timestamp on properties
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_properties_updated_at
  BEFORE UPDATE ON properties
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- Helper Functions
-- =====================================================

-- Function to get new properties from today
CREATE OR REPLACE FUNCTION get_new_properties_today()
RETURNS TABLE (
  id UUID,
  url TEXT,
  title TEXT,
  price TEXT,
  category TEXT,
  category_type TEXT,
  first_seen_date DATE
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id, p.url, p.title, p.price, p.category, p.category_type, p.first_seen_date
  FROM properties p
  WHERE p.first_seen_date = CURRENT_DATE
  AND p.is_active = true
  ORDER BY p.created_at DESC;
END;
$$ LANGUAGE plpgsql;

-- Function to get recently sold properties
CREATE OR REPLACE FUNCTION get_recently_sold_properties(days_back INTEGER DEFAULT 7)
RETURNS TABLE (
  id UUID,
  url TEXT,
  title TEXT,
  price TEXT,
  category TEXT,
  category_type TEXT,
  last_seen_date DATE
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id, p.url, p.title, p.price, p.category, p.category_type, p.last_seen_date
  FROM properties p
  WHERE p.is_active = false
  AND p.last_seen_date >= CURRENT_DATE - days_back
  ORDER BY p.last_seen_date DESC;
END;
$$ LANGUAGE plpgsql;

-- Function to get diff between two dates
CREATE OR REPLACE FUNCTION get_daily_diff(target_date DATE DEFAULT CURRENT_DATE)
RETURNS TABLE (
  category TEXT,
  new_count BIGINT,
  sold_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  WITH new_props AS (
    SELECT p.category, COUNT(*) as count
    FROM properties p
    WHERE p.first_seen_date = target_date
    GROUP BY p.category
  ),
  sold_props AS (
    SELECT p.category, COUNT(*) as count
    FROM properties p
    WHERE p.last_seen_date = target_date
    AND p.is_active = false
    GROUP BY p.category
  )
  SELECT 
    COALESCE(n.category, s.category) as category,
    COALESCE(n.count, 0) as new_count,
    COALESCE(s.count, 0) as sold_count
  FROM new_props n
  FULL OUTER JOIN sold_props s ON n.category = s.category;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- Row Level Security (Optional - uncomment if needed)
-- =====================================================

-- Enable RLS on tables
-- ALTER TABLE properties ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE daily_link_snapshots ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE property_snapshots ENABLE ROW LEVEL SECURITY;

-- Create policies (example: allow all for authenticated users)
-- CREATE POLICY "Allow all for authenticated users" ON properties
--   FOR ALL USING (auth.role() = 'authenticated');

-- CREATE POLICY "Allow all for authenticated users" ON daily_link_snapshots
--   FOR ALL USING (auth.role() = 'authenticated');

-- CREATE POLICY "Allow all for authenticated users" ON property_snapshots
--   FOR ALL USING (auth.role() = 'authenticated');

-- =====================================================
-- Sample Queries (for testing)
-- =====================================================

-- Get all active properties
-- SELECT * FROM properties WHERE is_active = true LIMIT 10;

-- Get new properties today
-- SELECT * FROM get_new_properties_today();

-- Get sold properties in last 7 days
-- SELECT * FROM get_recently_sold_properties(7);

-- Get today's diff by category
-- SELECT * FROM get_daily_diff(CURRENT_DATE);

-- Get link snapshot for a specific date
-- SELECT * FROM daily_link_snapshots WHERE snapshot_date = '2025-11-22';

-- Query property_data JSONB field
-- SELECT url, title, property_data->>'家賃' as rent 
-- FROM properties 
-- WHERE category = 'jukyo' 
-- LIMIT 10;

-- =====================================================
-- Migration Complete
-- =====================================================

COMMENT ON TABLE properties IS 'Current active property listings with flexible JSONB storage';
COMMENT ON TABLE daily_link_snapshots IS 'Daily snapshots of property URLs for diff detection';
COMMENT ON TABLE property_snapshots IS 'Historical snapshots of property details';
