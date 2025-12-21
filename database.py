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

DATABASE_TYPE: str = os.getenv("DATABASE_TYPE", "supabase")  # "sqlite" or "supabase"
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
        from supabase import create_client, Client
        
        url = os.getenv("SUPABASE_URL")
        key = os.getenv("SUPABASE_ANON_KEY")  # Usually acceptable for client ops, but strict RLS might need service role
        
        if not url or not key:
            raise ValueError("SUPABASE_URL and SUPABASE_ANON_KEY must be set in .env")
        
        self.supabase: Client = create_client(url, key)
    
    def _run_sqlite_migration(self):
        """Run SQLite migration script"""
        migration_file = "sqlite_migration.sql"
        
        if os.path.exists(migration_file):
            with open(migration_file, "r", encoding="utf-8") as f:
                sql_script = f.read()
        else:
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
            # Ensure complex types are appropriate (lists/dicts are auto-handled by client if column type is JSON)
            # Add default active/date fields if missing to match SQLite logic
            payload = data.copy()
            if "is_active" not in payload:
                payload["is_active"] = True
            if "first_seen_date" not in payload:
                # IMPORTANT: In upsert, we don't want to overwrite first_seen_date if it exists.
                # However, Supabase upsert will overwrite unless we handle it carefully.
                # Standard 'upsert' overwrites everything.
                # To preserve first_seen_date, we might check existence first or use ON CONFLICT DO NOTHING for that column?
                # Supabase API doesn't support granular column exclusion in standard upsert easily.
                # Strategy: We assume 'data' contains first_seen_date if it's new, 
                # or we trust the caller. If caller passes first_seen_date for existing item, it gets updated.
                # Actually, in SQLite logic:
                # INSERT ... VALUES (..., date('now'), ...) 
                # DO UPDATE SET ... (no first_seen_date in SET clause)
                # So SQLite preserves first_seen_date.
                # Supabase: We can't do partial updates on conflict easily in one call without rpc.
                # Workaround: Check existence? Or just tolerate overwriting for now (less ideal).
                # BETTER: Try to fetch first.
                pass 
                
            # If preserving first_seen_date is critical, we need to read first.
            # But that doubles API calls. For now, let's just insert.
            # If we want to emulate SQLite 'first_seen_date = date.today()' only on insert:
            
            # Simple approach: Just upsert.
            # However, we must ensure `last_seen_date` IS updated.
            payload['last_seen_date'] = date.today().isoformat()
            
            # For first_seen_date: if it's not in the input `data` dict, we adding it might overwrite 'null'?
            # If row exists, we want to KEEP existing first_seen_date.
            # Supabase behavior: If we send {url:..., first_seen_date: 'today'}, it updates to today.
            # To avoid this, we should NOT include first_seen_date in the payload if checking existence is expensive.
            # BUT: If it's a NEW record, we MUST include it.
            # Compromise: We try to Select first.
            
            existing = self.supabase.table("properties").select("first_seen_date").eq("url", data["url"]).execute()
            
            if existing.data and len(existing.data) > 0:
                # Existing record: Don't change first_seen_date
                if "first_seen_date" in payload:
                    del payload["first_seen_date"] # Keep existing
            else:
                # New record: Set first_seen_date
                if "first_seen_date" not in payload:
                    payload["first_seen_date"] = date.today().isoformat()
            
            self.supabase.table("properties").upsert(payload, on_conflict="url").execute()
            return True
        except Exception as e:
            print(f"Error upserting property to Supabase: {e}")
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
            # urls needs to be a JSON array if the column is JSON/JSONB.
            # supabase-py should handle list -> json automatically.
            self.supabase.table("daily_link_snapshots").upsert(data, on_conflict="snapshot_date,category").execute()
            return True
        except Exception as e:
            print(f"Error saving link snapshot to Supabase: {e}")
            return False
    
    def get_previous_links(self, category: str, days_back: int = 1) -> List[str]:
        """Get links from most recent snapshot (not strictly days_back)"""
        if self.db_type == "sqlite":
            return self._get_previous_links_sqlite(category, days_back)
        else:
            return self._get_previous_links_supabase(category, days_back)
    
    def _get_previous_links_sqlite(self, category: str, days_back: int) -> List[str]:
        """SQLite implementation"""
        conn = self._get_sqlite_connection()
        cursor = conn.cursor()
        
        try:
            today = date.today().isoformat()
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
        """Supabase implementation"""
        today = date.today().isoformat()
        
        # Order by snapshot_date DESC, limit 1, filter date < today
        result = self.supabase.table("daily_link_snapshots")\
            .select("urls, snapshot_date")\
            .eq("category", category)\
            .lt("snapshot_date", today)\
            .order("snapshot_date", desc=True)\
            .limit(1)\
            .execute()
        
        if result.data:
            print(f"[{category}] Using snapshot from {result.data[0]['snapshot_date']} for diff detection")
            return result.data[0]["urls"] # supabase-py converts JSON to list auto
        
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
        BATCH_SIZE = 100
        total_marked = 0
        for i in range(0, len(urls), BATCH_SIZE):
            batch_urls = urls[i:i + BATCH_SIZE]
            try:
                result = self.supabase.table("properties")\
                    .update({"is_active": False, "last_seen_date": date.today().isoformat()})\
                    .in_("url", batch_urls)\
                    .execute()
                batch_count = len(result.data) if result.data else 0
                total_marked += batch_count
            except Exception as e:
                print(f"Error marking properties inactive (batch {i//BATCH_SIZE + 1}): {e}")
                continue
        return total_marked
    
    # ================================================================
    # QUERY METHODS
    # ================================================================
    
    def get_all_active_properties(self) -> List[Dict]:
        if self.db_type == "sqlite":
            return self._get_all_active_properties_sqlite()
        else:
            return self._get_all_active_properties_supabase()
    
    def _get_all_active_properties_sqlite(self) -> List[Dict]:
        conn = self._get_sqlite_connection()
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        try:
            cursor.execute("SELECT * FROM properties WHERE is_active = 1")
            rows = cursor.fetchall()
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
        # Might need pagination if count is large
        all_data = []
        page_size = 1000
        from_idx = 0
        while True:
            result = self.supabase.table("properties")\
                .select("*")\
                .eq("is_active", True)\
                .range(from_idx, from_idx + page_size - 1)\
                .execute()
            if not result.data:
                break
            all_data.extend(result.data)
            if len(result.data) < page_size:
                break
            from_idx += page_size
        return all_data

    # ================================================================
    # STATISTICS METHODS
    # ================================================================

    def get_price_statistics(self) -> Dict[str, Any]:
        if self.db_type == "sqlite":
            return self._get_price_statistics_sqlite()
        else:
            return self._get_price_statistics_supabase()

    def _get_price_statistics_sqlite(self) -> Dict[str, Any]:
        # (Same as your original code for SQLite)
        conn = self._get_sqlite_connection()
        cursor = conn.cursor()
        try:
            cursor.execute("""
                SELECT property_data FROM properties 
                WHERE is_active = 1 AND property_data IS NOT NULL AND property_data != '{}'
            """)
            prices = self._extract_prices_from_cursor(cursor)
            return self._calculate_stats(prices)
        finally:
            conn.close()

    def _get_price_statistics_supabase(self) -> Dict[str, Any]:
        # Supabase implementation
        # Fetch only necessary column to save bandwidth
        # Need to iterate because parsing logic is in Python
        # RPC would be better, but doing client-side for now for compatibility
        prices = []
        page_size = 1000
        from_idx = 0
        while True:
            result = self.supabase.table("properties")\
                .select("property_data")\
                .eq("is_active", True)\
                .range(from_idx, from_idx + page_size - 1)\
                .execute()
            
            if not result.data:
                break
                
            for row in result.data:
                price = self._parse_price_from_dict(row.get("property_data", {}))
                if price:
                    prices.append(price)
            
            if len(result.data) < page_size:
                break
            from_idx += page_size
            
        return self._calculate_stats(prices)

    def _parse_price_from_dict(self, data: Dict) -> Optional[float]:
        try:
            if not isinstance(data, dict): return None
            price_str = data.get("価格") or data.get("家賃") or data.get("price")
            if not price_str: return None
            
            import re
            price_str = str(price_str).replace(',', '')
            
            if '億' in price_str:
                match = re.search(r'(\d+)億(\d+)万', price_str)
                if match:
                    return float(match.group(1)) * 10000 + float(match.group(2))
                match = re.search(r'(\d+)億', price_str)
                if match:
                    return float(match.group(1)) * 10000
            elif '万' in price_str:
                match = re.search(r'([0-9.]+)万', price_str)
                if match:
                    return float(match.group(1))
            else:
                match = re.search(r'([0-9.]+)', price_str)
                if match:
                    return float(match.group(1))
        except:
            return None
        return None

    def _extract_prices_from_cursor(self, cursor) -> List[float]:
        prices = []
        for row in cursor.fetchall():
            try:
                data = json.loads(row[0])
                p = self._parse_price_from_dict(data)
                if p: prices.append(p)
            except:
                continue
        return prices

    def _calculate_stats(self, prices: List[float]) -> Dict[str, Any]:
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

    def get_category_statistics(self) -> Dict[str, Dict[str, Any]]:
        if self.db_type == "sqlite":
            return self._get_category_statistics_sqlite()
        else:
            return self._get_category_statistics_supabase()

    def _get_category_statistics_sqlite(self) -> Dict[str, Dict[str, Any]]:
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
        # This requires aggregation which Supabase JS/Py client doesn't do natively easily without RPC
        # Basic approach: Fetch all 'category, genre_name_ja, category_type, first_seen_date' columns for active=true
        # Then aggregate in Python.
        
        all_rows = []
        page_size = 1000
        from_idx = 0
        today_str = date.today().isoformat()
        
        while True:
            result = self.supabase.table("properties")\
                .select("category, genre_name_ja, category_type, first_seen_date")\
                .eq("is_active", True)\
                .range(from_idx, from_idx + page_size - 1)\
                .execute()
            
            if not result.data:
                break
            all_rows.extend(result.data)
            if len(result.data) < page_size:
                break
            from_idx += page_size
            
        results = {}
        for row in all_rows:
            cat = row.get("category")
            if not cat: continue
            
            if cat not in results:
                results[cat] = {
                    "category": cat,
                    "genre_name_ja": row.get("genre_name_ja"),
                    "category_type": row.get("category_type"),
                    "count": 0,
                    "new_today": 0
                }
            
            results[cat]["count"] += 1
            if row.get("first_seen_date") and str(row.get("first_seen_date")).startswith(today_str):
                results[cat]["new_today"] += 1
                
        return results

    def get_area_distribution(self) -> Dict[str, int]:
        if self.db_type == "sqlite":
            return self._get_area_distribution_sqlite()
        else:
            return self._get_area_distribution_supabase()
            
    def _get_area_distribution_sqlite(self) -> Dict[str, int]:
        # (Existing SQLite logic)
        conn = self._get_sqlite_connection()
        cursor = conn.cursor()
        try:
            cursor.execute("SELECT property_data FROM properties WHERE is_active = 1")
            area_counts = {}
            for row in cursor.fetchall():
                if row[0]:
                    try:
                        data = json.loads(row[0])
                        self._count_area(data, area_counts)
                    except: pass
            return dict(sorted(area_counts.items(), key=lambda x: x[1], reverse=True)[:10])
        finally:
            conn.close()

    def _get_area_distribution_supabase(self) -> Dict[str, int]:
        # Supabase logic
        area_counts = {}
        page_size = 1000
        from_idx = 0
        while True:
            result = self.supabase.table("properties")\
                .select("property_data")\
                .eq("is_active", True)\
                .range(from_idx, from_idx + page_size - 1)\
                .execute()
            if not result.data: break
            for item in result.data:
                self._count_area(item.get("property_data", {}), area_counts)
            if len(result.data) < page_size: break
            from_idx += page_size
        return dict(sorted(area_counts.items(), key=lambda x: x[1], reverse=True)[:10])

    def _count_area(self, data: Dict, counts: Dict[str, int]):
        if not isinstance(data, dict): return
        location = data.get("所在地") or data.get("住所") or data.get("location") or data.get("area")
        if not location: return
        import re
        location = str(location).replace('沖縄県', '').strip()
        match = re.search(r'([^市]+市|[^町]+町|[^村]+村)', location)
        city = match.group(1) if match else location.split()[0]
        if city:
            counts[city] = counts.get(city, 0) + 1

    def get_time_based_statistics(self) -> Dict[str, Any]:
        if self.db_type == "sqlite":
            return self._get_time_based_statistics_sqlite()
        else:
            return self._get_time_based_statistics_supabase()
            
    def _get_time_based_statistics_sqlite(self) -> Dict[str, Any]:
        # (Existing Code)
        conn = self._get_sqlite_connection()
        cursor = conn.cursor()
        try:
            cursor.execute("""
                SELECT 
                    COUNT(CASE WHEN first_seen_date = date('now') THEN 1 END) as new_today,
                    COUNT(CASE WHEN first_seen_date >= date('now', '-7 days') THEN 1 END) as new_week,
                    COUNT(CASE WHEN first_seen_date >= date('now', '-30 days') THEN 1 END) as new_month
                FROM properties WHERE is_active = 1
            """)
            row = cursor.fetchone()
            cursor.execute("""
                SELECT 
                    COUNT(CASE WHEN last_seen_date = date('now') THEN 1 END) as sold_today,
                    COUNT(CASE WHEN last_seen_date >= date('now', '-7 days') THEN 1 END) as sold_week,
                    COUNT(CASE WHEN last_seen_date >= date('now', '-30 days') THEN 1 END) as sold_month
                FROM properties WHERE is_active = 0
            """)
            sold_row = cursor.fetchone()
            return {
                "new_today": row[0], "new_week": row[1], "new_month": row[2],
                "sold_today": sold_row[0], "sold_week": sold_row[1], "sold_month": sold_row[2]
            }
        finally:
            conn.close()

    def _get_time_based_statistics_supabase(self) -> Dict[str, Any]:
        # Supabase Implementation
        today = date.today()
        import datetime
        week_ago = (today - datetime.timedelta(days=7)).isoformat()
        month_ago = (today - datetime.timedelta(days=30)).isoformat()
        today_str = today.isoformat()
        
        # Helper to count
        def get_count(table, filters):
            q = self.supabase.table(table).select("*", count="exact", head=True)
            for k, v in filters.items():
                # Handling simple filters. Complex ones might need string parsing
                if k.endswith("__gte"):
                    q = q.gte(k.replace("__gte", ""), v)
                elif k == "is_active":
                    q = q.eq(k, v)
                elif k == "first_seen_date":
                    q = q.eq(k, v)
                elif k == "last_seen_date":
                    q = q.eq(k, v)
            r = q.execute()
            return r.count if r.count else 0
        
        return {
            "new_today": get_count("properties", {"is_active": True, "first_seen_date": today_str}),
            "new_week": get_count("properties", {"is_active": True, "first_seen_date__gte": week_ago}),
            "new_month": get_count("properties", {"is_active": True, "first_seen_date__gte": month_ago}),
            
            "sold_today": get_count("properties", {"is_active": False, "last_seen_date": today_str}),
            "sold_week": get_count("properties", {"is_active": False, "last_seen_date__gte": week_ago}),
            "sold_month": get_count("properties", {"is_active": False, "last_seen_date__gte": month_ago})
        }

db = Database()
