-- =====================================================
-- Supabase Database Setup - Clean Install
-- =====================================================
-- 既存のテーブルを削除してから再作成します

-- 1. 既存のテーブルを削除（順序重要）
DROP TABLE IF EXISTS generated_images CASCADE;
DROP TABLE IF EXISTS daily_link_snapshots CASCADE;
DROP TABLE IF EXISTS properties CASCADE;

-- 2. Properties テーブル作成
CREATE TABLE properties (
    id BIGSERIAL PRIMARY KEY,
    url TEXT NOT NULL UNIQUE,
    category TEXT NOT NULL,
    category_type TEXT,
    category_name_ja TEXT,
    genre_name_ja TEXT,
    title TEXT,
    price TEXT,
    favorites INTEGER DEFAULT 0,
    update_date TEXT,
    expiry_date TEXT,
    images JSONB DEFAULT '[]'::jsonb,
    company_name TEXT,
    property_data JSONB DEFAULT '{}'::jsonb,
    is_active BOOLEAN DEFAULT true,
    first_seen_date DATE DEFAULT CURRENT_DATE,
    last_seen_date DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Daily Link Snapshots テーブル作成
CREATE TABLE daily_link_snapshots (
    id BIGSERIAL PRIMARY KEY,
    snapshot_date DATE NOT NULL,
    category TEXT NOT NULL,
    urls JSONB NOT NULL DEFAULT '[]'::jsonb,
    url_count INTEGER DEFAULT 0,
    scraped_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(snapshot_date, category)
);

-- 4. Generated Images テーブル作成
CREATE TABLE generated_images (
    id BIGSERIAL PRIMARY KEY,
    property_id BIGINT REFERENCES properties(id) ON DELETE CASCADE,
    image_url TEXT NOT NULL,
    filename TEXT,
    mode TEXT,
    style TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- インデックス作成
-- =====================================================

CREATE INDEX idx_properties_url ON properties(url);
CREATE INDEX idx_properties_category ON properties(category);
CREATE INDEX idx_properties_is_active ON properties(is_active);
CREATE INDEX idx_properties_first_seen ON properties(first_seen_date);
CREATE INDEX idx_properties_last_seen ON properties(last_seen_date);
CREATE INDEX idx_properties_created_at ON properties(created_at);
CREATE INDEX idx_properties_category_active ON properties(category, is_active);

CREATE INDEX idx_snapshots_date_category ON daily_link_snapshots(snapshot_date, category);
CREATE INDEX idx_snapshots_date ON daily_link_snapshots(snapshot_date DESC);

CREATE INDEX idx_generated_images_property ON generated_images(property_id);

-- =====================================================
-- 自動更新トリガー
-- =====================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_properties_updated_at 
    BEFORE UPDATE ON properties
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- Row Level Security (RLS)
-- =====================================================

ALTER TABLE properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_link_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE generated_images ENABLE ROW LEVEL SECURITY;

-- 読み取り権限
CREATE POLICY "Allow public read on properties"
    ON properties FOR SELECT USING (true);

CREATE POLICY "Allow public read on snapshots"
    ON daily_link_snapshots FOR SELECT USING (true);

CREATE POLICY "Allow public read on images"
    ON generated_images FOR SELECT USING (true);

-- 書き込み権限（認証済みユーザー）
CREATE POLICY "Allow authenticated full access on properties"
    ON properties FOR ALL 
    USING (auth.role() = 'authenticated' OR auth.role() = 'service_role');

CREATE POLICY "Allow authenticated full access on snapshots"
    ON daily_link_snapshots FOR ALL 
    USING (auth.role() = 'authenticated' OR auth.role() = 'service_role');

CREATE POLICY "Allow authenticated full access on images"
    ON generated_images FOR ALL 
    USING (auth.role() = 'authenticated' OR auth.role() = 'service_role');

-- =====================================================
-- ビュー作成
-- =====================================================

CREATE OR REPLACE VIEW active_properties AS
SELECT 
    id, url, category, category_name_ja, genre_name_ja,
    title, price, favorites, update_date, company_name,
    property_data, first_seen_date, last_seen_date,
    created_at, updated_at
FROM properties
WHERE is_active = true;

CREATE OR REPLACE VIEW category_stats AS
SELECT 
    category,
    category_name_ja,
    COUNT(*) as total_count,
    COUNT(*) FILTER (WHERE is_active = true) as active_count,
    COUNT(*) FILTER (WHERE is_active = false) as sold_count,
    COUNT(*) FILTER (WHERE first_seen_date = CURRENT_DATE) as new_today,
    MAX(updated_at) as last_updated
FROM properties
GROUP BY category, category_name_ja;
