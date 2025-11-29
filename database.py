"""
Database Abstraction Layer
SQLiteとSupabaseの両方に対応したデータベース操作
"""

import os
import json
import sqlite3
from datetime import datetime, date
from typing import List, Dict, Optional, Any, Tuple, Union
from dotenv import load_dotenv

load_dotenv()

DATABASE_TYPE: str = os.getenv("DATABASE_TYPE", "sqlite")  # "sqlite" or "supabase"
SQLITE_DB_PATH: str = os.getenv("SQLITE_DB_PATH", "output/properties.db")


class Database:
    """Database abstraction layer"""
    
    def __init__(self):
        self.db_type = DATABASE_TYPE
        
        if self.db_type == "sqlite":
            self._init_sqlite()
        elif self.db_type == "supabase":
            self._init_supabase()
        else:
            raise ValueError(f"Unknown DATABASE_TYPE: {self.db_type}")
    
    def _init_sqlite(self):
        """Initialize SQLite database"""
        self.db_path = SQLITE_DB_PATH
        
        # Create database directory if not exists
        os.makedirs(os.path.dirname(self.db_path) if os.path.dirname(self.db_path) else ".", exist_ok=True)
        
        # Run migration if database doesn't exist
        if not os.path.exists(self.db_path):
            print(f"Creating SQLite database: {self.db_path}")
            self._run_sqlite_migration()
    
    def _init_supabase(self):
        """Initialize Supabase client"""
        from supabase import create_client
        
        url = os.getenv("SUPABASE_URL")
        key = os.getenv("SUPABASE_ANON_KEY")
        
        if not url or not key:
            raise ValueError("SUPABASE_URL and SUPABASE_ANON_KEY must be set in .env")
        
        self.supabase = create_client(url, key)
    
    def _run_sqlite_migration(self):
        """Run SQLite migration script"""
        migration_file = "sqlite_migration.sql"
        
        # マイグレーションファイルが存在するか確認
        if os.path.exists(migration_file):
            with open(migration_file, "r", encoding="utf-8") as f:
                sql_script = f.read()
        else:
            # ファイルが見つからない場合は、インラインでテーブルを作成
            sql_script = """
            CREATE TABLE IF NOT EXISTS properties (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
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
                images TEXT,
                company_name TEXT,
                property_data TEXT,
                is_active INTEGER DEFAULT 1,
                first_seen_date TEXT,
                last_seen_date TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS daily_link_snapshots (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                snapshot_date TEXT NOT NULL,
                category TEXT NOT NULL,
                urls TEXT NOT NULL,
                url_count INTEGER DEFAULT 0,
                scraped_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(snapshot_date, category)
            );

            CREATE INDEX IF NOT EXISTS idx_properties_url ON properties(url);
            CREATE INDEX IF NOT EXISTS idx_properties_category ON properties(category);
            CREATE INDEX IF NOT EXISTS idx_properties_is_active ON properties(is_active);
            CREATE INDEX IF NOT EXISTS idx_properties_first_seen ON properties(first_seen_date);
            CREATE INDEX IF NOT EXISTS idx_properties_last_seen ON properties(last_seen_date);
            CREATE INDEX IF NOT EXISTS idx_snapshots_date_category ON daily_link_snapshots(snapshot_date, category);
            """
        
        conn = sqlite3.connect(self.db_path)
        conn.executescript(sql_script)
        conn.commit()
        conn.close()
        print("SQLite migration completed")
    
    def _get_sqlite_connection(self):
        """Get SQLite connection"""
        return sqlite3.connect(self.db_path)
    
    # ================================================================
    # UPSERT PROPERTY
    # ================================================================
    
    def upsert_property(self, property_data: Dict[str, Any]) -> bool:
        """Insert or update property"""
        if self.db_type == "sqlite":
            return self._upsert_property_sqlite(property_data)
        else:
            return self._upsert_property_supabase(property_data)
    
    def _upsert_property_sqlite(self, data: Dict[str, Any]) -> bool:
        """SQLite implementation of upsert_property"""
        conn = self._get_sqlite_connection()
        cursor = conn.cursor()
        
        try:
            # Convert arrays and objects to JSON strings
            images_json = json.dumps(data.get("images", []))
            property_data_json = json.dumps(data.get("property_data", {}))
            
            cursor.execute("""
                INSERT INTO properties (
                    url, category, category_type, category_name_ja, genre_name_ja,
                    title, price, favorites, update_date, expiry_date,
                    images, company_name, property_data,
                    is_active, first_seen_date, last_seen_date
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(url) DO UPDATE SET
                    title = excluded.title,
                    price = excluded.price,
                    favorites = excluded.favorites,
                    update_date = excluded.update_date,
                    expiry_date = excluded.expiry_date,
                    images = excluded.images,
                    company_name = excluded.company_name,
                    property_data = excluded.property_data,
                    last_seen_date = excluded.last_seen_date,
                    updated_at = CURRENT_TIMESTAMP
            """, (
                data["url"], data["category"], data["category_type"],
                data["category_name_ja"], data["genre_name_ja"],
                data.get("title"), data.get("price"), data.get("favorites", 0),
                data.get("update_date"), data.get("expiry_date"),
                images_json, data.get("company_name"), property_data_json,
                1, date.today().isoformat(), date.today().isoformat()
            ))
            
            conn.commit()
            return True
        except Exception as e:
            print(f"Error upserting property: {e}")
            conn.rollback()
            return False
        finally:
            conn.close()
    
    def _upsert_property_supabase(self, data: Dict[str, Any]) -> bool:
        """Supabase implementation of upsert_property"""
        try:
            self.supabase.table("properties").upsert(data, on_conflict="url").execute()
            return True
        except Exception as e:
            print(f"Error upserting property: {e}")
            return False
    
    # ================================================================
    # LINK SNAPSHOTS
    # ================================================================
    
    def save_link_snapshot(self, category: str, urls: List[str]) -> bool:
        """Save daily link snapshot"""
        if self.db_type == "sqlite":
            return self._save_link_snapshot_sqlite(category, urls)
        else:
            return self._save_link_snapshot_supabase(category, urls)
    
    def _save_link_snapshot_sqlite(self, category: str, urls: List[str]) -> bool:
        """SQLite implementation"""
        conn = self._get_sqlite_connection()
        cursor = conn.cursor()
        
        try:
            today = date.today().isoformat()
            urls_json = json.dumps(urls)
            
            cursor.execute("""
                INSERT INTO daily_link_snapshots (snapshot_date, category, urls, url_count)
                VALUES (?, ?, ?, ?)
                ON CONFLICT(snapshot_date, category) DO UPDATE SET
                    urls = excluded.urls,
                    url_count = excluded.url_count,
                    scraped_at = CURRENT_TIMESTAMP
            """, (today, category, urls_json, len(urls)))
            
            conn.commit()
            return True
        except Exception as e:
            print(f"Error saving link snapshot: {e}")
            conn.rollback()
            return False
        finally:
            conn.close()
    
    def _save_link_snapshot_supabase(self, category: str, urls: List[str]) -> bool:
        """Supabase implementation"""
        try:
            data = {
                "snapshot_date": date.today().isoformat(),
                "category": category,
                "urls": urls,
                "url_count": len(urls)
            }
            self.supabase.table("daily_link_snapshots").upsert(data, on_conflict="snapshot_date,category").execute()
            return True
        except Exception as e:
            print(f"Error saving link snapshot: {e}")
            return False
    
    def get_previous_links(self, category: str, days_back: int = 1) -> List[str]:
        """Get links from most recent snapshot (not strictly days_back)"""
        if self.db_type == "sqlite":
            return self._get_previous_links_sqlite(category, days_back)
        else:
            return self._get_previous_links_supabase(category, days_back)
    
    def _get_previous_links_sqlite(self, category: str, days_back: int) -> List[str]:
        """SQLite implementation - gets most recent snapshot before today"""
        conn = self._get_sqlite_connection()
        cursor = conn.cursor()
        
        try:
            today = date.today().isoformat()
            
            # Get the most recent snapshot before today
            cursor.execute("""
                SELECT urls, snapshot_date FROM daily_link_snapshots
                WHERE category = ? AND snapshot_date < ?
                ORDER BY snapshot_date DESC
                LIMIT 1
            """, (category, today))
            
            result = cursor.fetchone()
            if result:
                print(f"[{category}] Using snapshot from {result[1]} for diff detection")
                return json.loads(result[0])
            
            print(f"[{category}] No previous snapshot found - treating all as new")
            return []
        finally:
            conn.close()
    
    def _get_previous_links_supabase(self, category: str, days_back: int) -> List[str]:
        """Supabase implementation - gets most recent snapshot before today"""
        today = date.today().isoformat()
        
        result = self.supabase.table("daily_link_snapshots")\
            .select("urls, snapshot_date")\
            .eq("category", category)\
            .lt("snapshot_date", today)\
            .order("snapshot_date", desc=True)\
            .limit(1)\
            .execute()
        
        if result.data:
            print(f"[{category}] Using snapshot from {result.data[0]['snapshot_date']} for diff detection")
            return result.data[0]["urls"]
        
        print(f"[{category}] No previous snapshot found - treating all as new")
        return []
    
    # ================================================================
    # MARK PROPERTIES AS INACTIVE
    # ================================================================
    
    def mark_properties_inactive(self, urls: List[str]) -> int:
        """Mark properties as inactive (sold)"""
        if self.db_type == "sqlite":
            return self._mark_properties_inactive_sqlite(urls)
        else:
            return self._mark_properties_inactive_supabase(urls)
    
    def _mark_properties_inactive_sqlite(self, urls: List[str]) -> int:
        """SQLite implementation"""
        if not urls:
            return 0
        
        conn = self._get_sqlite_connection()
        cursor = conn.cursor()
        
        try:
            placeholders = ','.join('?' * len(urls))
            cursor.execute(f"""
                UPDATE properties
                SET is_active = 0, last_seen_date = date('now')
                WHERE url IN ({placeholders})
            """, urls)
            
            affected = cursor.rowcount
            conn.commit()
            return affected
        finally:
            conn.close()
    
    def _mark_properties_inactive_supabase(self, urls: List[str]) -> int:
        """Supabase implementation"""
        if not urls:
            return 0
        
        try:
            result = self.supabase.table("properties")\
                .update({"is_active": False, "last_seen_date": date.today().isoformat()})\
                .in_("url", urls)\
                .execute()
            return len(result.data) if result.data else 0
        except Exception as e:
            print(f"Error marking properties inactive: {e}")
            return 0
    
    # ================================================================
    # QUERY METHODS
    # ================================================================
    
    def get_all_active_properties(self) -> List[Dict]:
        """Get all active properties"""
        if self.db_type == "sqlite":
            return self._get_all_active_properties_sqlite()
        else:
            return self._get_all_active_properties_supabase()
    
    def _get_all_active_properties_sqlite(self) -> List[Dict]:
        """SQLite implementation"""
        conn = self._get_sqlite_connection()
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        
        try:
            cursor.execute("SELECT * FROM properties WHERE is_active = 1")
            rows = cursor.fetchall()
            
            # Convert to list of dicts and parse JSON fields
            results = []
            for row in rows:
                data = dict(row)
                data["images"] = json.loads(data["images"]) if data["images"] else []
                data["property_data"] = json.loads(data["property_data"]) if data["property_data"] else {}
                data["is_active"] = bool(data["is_active"])
                results.append(data)
            
            return results
        finally:
            conn.close()
    
    def _get_all_active_properties_supabase(self) -> List[Dict]:
        """Supabase implementation"""
        result = self.supabase.table("properties")\
            .select("*")\
            .eq("is_active", True)\
            .execute()
        return result.data if result.data else []
    
    # ================================================================
    # STATISTICS METHODS
    # ================================================================
    
    def get_price_statistics(self) -> Dict[str, Any]:
        """Get comprehensive price statistics"""
        if self.db_type == "sqlite":
            return self._get_price_statistics_sqlite()
        else:
            return self._get_price_statistics_supabase()
    
    def _get_price_statistics_sqlite(self) -> Dict[str, Any]:
        """SQLite price statistics"""
        conn = self._get_sqlite_connection()
        cursor = conn.cursor()
        
        try:
            # Extract prices from property_data
            cursor.execute("""
                SELECT property_data FROM properties 
                WHERE is_active = 1 AND property_data IS NOT NULL AND property_data != '{}'
            """)
            
            prices = []
            for row in cursor.fetchall():
                try:
                    data = json.loads(row[0])
                    # Try multiple fields where price might be
                    price_str = data.get("価格") or data.get("家賃") or data.get("price")
                    
                    if price_str:
                        # Extract numbers from Japanese price format
                        # Examples: "4,980万円", "8.5万円", "1億4,800万円"
                        import re
                        
                        # Remove commas
                        price_str = price_str.replace(',', '')
                        
                        # Handle 億 (hundred million)
                        if '億' in price_str:
                            match = re.search(r'(\d+)億(\d+)万', price_str)
                            if match:
                                oku = int(match.group(1))
                                man = int(match.group(2))
                                prices.append(oku * 10000 + man)
                            else:
                                match = re.search(r'(\d+)億', price_str)
                                if match:
                                    prices.append(int(match.group(1)) * 10000)
                        # Handle 万円 (ten thousand yen)
                        elif '万' in price_str:
                            match = re.search(r'([0-9.]+)万', price_str)
                            if match:
                                prices.append(float(match.group(1)))
                        # Handle plain numbers
                        else:
                            match = re.search(r'([0-9.]+)', price_str)
                            if match:
                                prices.append(float(match.group(1)))
                except Exception as e:
                    continue
            
            if not prices:
                return {"average": 0, "median": 0, "min": 0, "max": 0, "count": 0}
            
            prices.sort()
            count = len(prices)
            median = prices[count // 2] if count % 2 == 1 else (prices[count // 2 - 1] + prices[count // 2]) / 2
            
            return {
                "average": round(sum(prices) / count, 1),
                "median": round(median, 1),
                "min": round(min(prices), 1),
                "max": round(max(prices), 1),
                "count": count
            }
        finally:
            conn.close()
    
    def _get_price_statistics_supabase(self) -> Dict[str, Any]:
        """Supabase price statistics"""
        # Similar implementation for Supabase
        return {"average": 0, "median": 0, "min": 0, "max": 0, "count": 0}
    
    def get_category_statistics(self) -> Dict[str, Dict[str, Any]]:
        """Get statistics by category"""
        if self.db_type == "sqlite":
            return self._get_category_statistics_sqlite()
        else:
            return self._get_category_statistics_supabase()
    
    def _get_category_statistics_sqlite(self) -> Dict[str, Dict[str, Any]]:
        """SQLite category statistics"""
        conn = self._get_sqlite_connection()
        cursor = conn.cursor()
        
        try:
            cursor.execute("""
                SELECT 
                    category,
                    genre_name_ja,
                    category_type,
                    COUNT(*) as count,
                    COUNT(CASE WHEN first_seen_date = date('now') THEN 1 END) as new_today
                FROM properties
                WHERE is_active = 1
                GROUP BY category
            """)
            
            results = {}
            for row in cursor.fetchall():
                results[row[0]] = {
                    "category": row[0],
                    "genre_name_ja": row[1],
                    "category_type": row[2],
                    "count": row[3],
                    "new_today": row[4]
                }
            
            return results
        finally:
            conn.close()
    
    def _get_category_statistics_supabase(self) -> Dict[str, Dict[str, Any]]:
        """Supabase category statistics"""
        # Supabase implementation
        return {}
    
    def get_area_distribution(self) -> Dict[str, int]:
        """Get property distribution by area (city)"""
        if self.db_type == "sqlite":
            return self._get_area_distribution_sqlite()
        else:
            return self._get_area_distribution_supabase()
    
    def _get_area_distribution_sqlite(self) -> Dict[str, int]:
        """SQLite area distribution"""
        conn = self._get_sqlite_connection()
        cursor = conn.cursor()
        
        try:
            cursor.execute("""
                SELECT property_data FROM properties WHERE is_active = 1
            """)
            
            area_counts = {}
            for row in cursor.fetchall():
                if row[0]:
                    try:
                        data = json.loads(row[0])
                        location = data.get("所在地", "")
                        if location:
                            # Extract city name (e.g., "那覇市" from "那覇市久茂地")
                            import re
                            match = re.search(r'([^市]+市|[^町]+町|[^村]+村)', location)
                            if match:
                                city = match.group(1)
                                area_counts[city] = area_counts.get(city, 0) + 1
                    except:
                        pass
            
            # Sort by count and return top 10
            sorted_areas = sorted(area_counts.items(), key=lambda x: x[1], reverse=True)[:10]
            return dict(sorted_areas)
        finally:
            conn.close()
    
    def _get_area_distribution_supabase(self) -> Dict[str, int]:
        """Supabase area distribution"""
        return {}
    
    def get_time_based_statistics(self) -> Dict[str, Any]:
        """Get time-based statistics (today, this week, this month)"""
        if self.db_type == "sqlite":
            return self._get_time_based_statistics_sqlite()
        else:
            return self._get_time_based_statistics_supabase()
    
    def _get_time_based_statistics_sqlite(self) -> Dict[str, Any]:
        """SQLite time-based statistics"""
        conn = self._get_sqlite_connection()
        cursor = conn.cursor()
        
        try:
            # New properties
            cursor.execute("""
                SELECT 
                    COUNT(CASE WHEN first_seen_date = date('now') THEN 1 END) as new_today,
                    COUNT(CASE WHEN first_seen_date >= date('now', '-7 days') THEN 1 END) as new_week,
                    COUNT(CASE WHEN first_seen_date >= date('now', '-30 days') THEN 1 END) as new_month
                FROM properties
                WHERE is_active = 1
            """)
            
            row = cursor.fetchone()
            
            # Sold properties (inactive)
            cursor.execute("""
                SELECT 
                    COUNT(CASE WHEN last_seen_date = date('now') THEN 1 END) as sold_today,
                    COUNT(CASE WHEN last_seen_date >= date('now', '-7 days') THEN 1 END) as sold_week,
                    COUNT(CASE WHEN last_seen_date >= date('now', '-30 days') THEN 1 END) as sold_month
                FROM properties
                WHERE is_active = 0
            """)
            
            sold_row = cursor.fetchone()
            
            return {
                "new_today": row[0],
                "new_week": row[1],
                "new_month": row[2],
                "sold_today": sold_row[0],
                "sold_week": sold_row[1],
                "sold_month": sold_row[2]
            }
        finally:
            conn.close()
    
    def _get_time_based_statistics_supabase(self) -> Dict[str, Any]:
        """Supabase time-based statistics"""
        return {
            "new_today": 0,
            "new_week": 0,
            "new_month": 0,
            "sold_today": 0,
            "sold_week": 0,
            "sold_month": 0
        }


# Create global database instance
db = Database()
