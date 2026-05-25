"""
API Server for うちなーらいふ不動産スクレイピングシステム
Provides REST API endpoints for property data
"""

from flask import Flask, jsonify, request, send_from_directory, Response
from flask_cors import CORS
from database import db
from datetime import datetime, date, timedelta
from typing import Tuple, Dict, Any, List, Optional
import os
import time
from threading import Lock
from config import config

app = Flask(__name__, static_folder='.')
CORS(app)

# Default landing page = dashboard (the old index.html is a legacy local-CSV viewer).
DEFAULT_PAGE = 'dashboard.html'

# ================================================================
# Stats cache (TTL) — avoids 70s full-table scans on every reload.
# ================================================================
_STATS_TTL_SEC = 600  # 10 minutes
_stats_cache: Dict[str, Any] = {"data": None, "ts": 0.0}
_stats_lock = Lock()

def _paging_params() -> Tuple[int, int]:
    try:
        page = max(1, int(request.args.get('page', 1)))
    except (TypeError, ValueError):
        page = 1
    try:
        page_size = int(request.args.get('page_size', 50))
    except (TypeError, ValueError):
        page_size = 50
    page_size = max(1, min(page_size, 200))
    return page, page_size

# ================================================================
# Static file serving
# ================================================================

@app.route('/')
def index():
    """Serve the dashboard as landing page."""
    return send_from_directory('.', DEFAULT_PAGE)

@app.route('/<path:path>')
def serve_static(path):
    """Serve static files"""
    return send_from_directory('.', path)

# ================================================================
# Property API Endpoints
# ================================================================

@app.route('/api/properties/all', methods=['GET'])
def get_all_properties():
    """
    Paginated list of active properties.
    Query params:
      - page (default 1), page_size (default 50, max 200)
      - category, category_type (filters pushed down to DB)
      - q: title keyword (ILIKE)
    """
    try:
        page, page_size = _paging_params()
        result = db.get_properties_paged(
            view="all",
            category=request.args.get('category') or None,
            category_type=request.args.get('category_type') or None,
            q=request.args.get('q') or None,
            offset=(page - 1) * page_size,
            limit=page_size,
        )
        total = result["total"]
        return jsonify({
            'success': True,
            'page': page,
            'page_size': page_size,
            'total': total,
            'total_pages': (total + page_size - 1) // page_size if page_size else 0,
            'count': len(result["data"]),
            'data': result["data"],
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/properties/new', methods=['GET'])
def get_new_properties():
    """
    Paginated list of properties first seen on a given date (default today).
    """
    try:
        target = request.args.get('date')
        if target:
            target_date = datetime.strptime(target, '%Y-%m-%d').date()
        else:
            target_date = date.today()
        page, page_size = _paging_params()
        result = db.get_properties_paged(
            view="new",
            category=request.args.get('category') or None,
            category_type=request.args.get('category_type') or None,
            q=request.args.get('q') or None,
            date_str=target_date.isoformat(),
            offset=(page - 1) * page_size,
            limit=page_size,
        )
        total = result["total"]
        return jsonify({
            'success': True,
            'date': target_date.isoformat(),
            'page': page,
            'page_size': page_size,
            'total': total,
            'total_pages': (total + page_size - 1) // page_size if page_size else 0,
            'count': len(result["data"]),
            'data': result["data"],
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

def _get_new_properties_sqlite(target_date):
    """SQLite implementation for getting new properties"""
    import sqlite3
    import json
    
    conn = db._get_sqlite_connection()
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    try:
        cursor.execute("""
            SELECT * FROM properties 
            WHERE first_seen_date = ? AND is_active = 1
            ORDER BY created_at DESC
        """, (target_date.isoformat(),))
        
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

def _get_new_properties_supabase(target_date):
    """Supabase implementation for getting new properties"""
    result = db.supabase.table("properties")\
        .select("*")\
        .eq("first_seen_date", target_date.isoformat())\
        .eq("is_active", True)\
        .order("created_at", desc=True)\
        .execute()
    
    return result.data if result.data else []

@app.route('/api/properties/sold', methods=['GET'])
def get_sold_properties():
    """
    Paginated list of recently sold/removed properties.
    Query params: page, page_size, days (default 7), category, category_type, q.
    """
    try:
        days_back = request.args.get('days', default=7, type=int)
        page, page_size = _paging_params()
        result = db.get_properties_paged(
            view="sold",
            category=request.args.get('category') or None,
            category_type=request.args.get('category_type') or None,
            q=request.args.get('q') or None,
            days_back=days_back,
            offset=(page - 1) * page_size,
            limit=page_size,
        )
        total = result["total"]
        return jsonify({
            'success': True,
            'days_back': days_back,
            'page': page,
            'page_size': page_size,
            'total': total,
            'total_pages': (total + page_size - 1) // page_size if page_size else 0,
            'count': len(result["data"]),
            'data': result["data"],
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

def _get_sold_properties_sqlite(cutoff_date):
    """SQLite implementation for getting sold properties"""
    import sqlite3
    import json
    
    conn = db._get_sqlite_connection()
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    try:
        cursor.execute("""
            SELECT * FROM properties 
            WHERE is_active = 0 AND last_seen_date >= ?
            ORDER BY last_seen_date DESC
        """, (cutoff_date,))
        
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

def _get_sold_properties_supabase(cutoff_date):
    """Supabase implementation for getting sold properties"""
    result = db.supabase.table("properties")\
        .select("*")\
        .eq("is_active", False)\
        .gte("last_seen_date", cutoff_date)\
        .order("last_seen_date", desc=True)\
        .execute()
    
    return result.data if result.data else []
# Advanced Statistics Endpoint
# Add this after line 222 in server.py

def _compute_advanced_stats() -> Dict[str, Any]:
    """Heavy aggregation work (~30-70s on 20K rows). Cached by caller."""
    time_stats = db.get_time_based_statistics()
    cat_stats = db.get_category_statistics()
    price_stats = db.get_price_statistics()
    area_dist = db.get_area_distribution()
    total_active = sum(c['count'] for c in cat_stats.values()) or db.get_active_count()

    by_type: Dict[str, int] = {}
    for cat in cat_stats.values():
        by_type[cat['category_type']] = by_type.get(cat['category_type'], 0) + cat['count']

    return {
        'success': True,
        'total_active': total_active,
        'new_today': time_stats['new_today'],
        'new_week': time_stats['new_week'],
        'new_month': time_stats['new_month'],
        'sold_today': time_stats['sold_today'],
        'sold_week': time_stats['sold_week'],
        'sold_month': time_stats['sold_month'],
        'price_stats': {
            'average': f"¥{price_stats['average']}万円",
            'median': f"¥{price_stats['median']}万円",
            'min': f"¥{price_stats['min']}万円",
            'max': f"¥{price_stats['max']}万円",
            'count': price_stats['count'],
            'average_raw': price_stats['average'],
            'median_raw': price_stats['median'],
            'min_raw': price_stats['min'],
            'max_raw': price_stats['max'],
        },
        'by_category': cat_stats,
        'by_type': by_type,
        'by_area': area_dist,
        'database_type': db.db_type,
    }

@app.route('/api/stats/advanced', methods=['GET'])
def get_advanced_stats():
    """Cached advanced stats. Pass ?fresh=1 to bypass the 10-min TTL."""
    try:
        force = request.args.get('fresh') in ('1', 'true', 'yes')
        now = time.time()
        with _stats_lock:
            cached = _stats_cache["data"]
            fresh_enough = cached and (now - _stats_cache["ts"] < _STATS_TTL_SEC)
        if cached and fresh_enough and not force:
            payload = dict(cached)
            payload['cached'] = True
            payload['cache_age_sec'] = int(now - _stats_cache["ts"])
            return jsonify(payload)

        data = _compute_advanced_stats()
        with _stats_lock:
            _stats_cache["data"] = data
            _stats_cache["ts"] = time.time()
        payload = dict(data)
        payload['cached'] = False
        return jsonify(payload)
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500
@app.route('/api/properties/diff', methods=['GET'])
def get_daily_diff():
    """
    Get today's diff: new and sold properties by category
    Query params:
      - date: Date in YYYY-MM-DD format (optional, defaults to today)
    """
    try:
        target_date = request.args.get('date')
        if target_date:
            target_date = datetime.strptime(target_date, '%Y-%m-%d').date()
        else:
            target_date = date.today()
        
        # Get new properties
        new_props = _get_new_properties_sqlite(target_date) if db.db_type == 'sqlite' else _get_new_properties_supabase(target_date)
        
        # Get sold properties (from target date)
        if db.db_type == 'sqlite':
            sold_props = _get_sold_on_date_sqlite(target_date)
        else:
            sold_props = _get_sold_on_date_supabase(target_date)
        
        # Group by category
        def group_by_category(properties):
            by_category = {}
            for prop in properties:
                cat = prop['category']
                if cat not in by_category:
                    by_category[cat] = []
                by_category[cat].append(prop)
            return by_category
        
        new_by_category = group_by_category(new_props)
        sold_by_category = group_by_category(sold_props)
        
        # Build summary
        all_categories = set(list(new_by_category.keys()) + list(sold_by_category.keys()))
        summary = {}
        
        for cat in all_categories:
            summary[cat] = {
                'new_count': len(new_by_category.get(cat, [])),
                'sold_count': len(sold_by_category.get(cat, [])),
                'new_properties': new_by_category.get(cat, []),
                'sold_properties': sold_by_category.get(cat, [])
            }
        
        return jsonify({
            'success': True,
            'date': target_date.isoformat(),
            'total_new': len(new_props),
            'total_sold': len(sold_props),
            'by_category': summary
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

def _get_sold_on_date_sqlite(target_date):
    """Get properties sold on specific date (SQLite)"""
    import sqlite3
    import json
    
    conn = db._get_sqlite_connection()
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    try:
        cursor.execute("""
            SELECT * FROM properties 
            WHERE is_active = 0 AND last_seen_date = ?
            ORDER BY last_seen_date DESC
        """, (target_date.isoformat(),))
        
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

def _get_sold_on_date_supabase(target_date):
    """Get properties sold on specific date (Supabase)"""
    result = db.supabase.table("properties")\
        .select("*")\
        .eq("is_active", False)\
        .eq("last_seen_date", target_date.isoformat())\
        .order("last_seen_date", desc=True)\
        .execute()
    
    return result.data if result.data else []

@app.route('/api/stats', methods=['GET'])
def get_stats():
    """Get overall statistics"""
    try:
        properties = db.get_all_active_properties()
        
        # Calculate stats
        total = len(properties)
        by_category = {}
        by_type = {'賃貸': 0, '売買': 0}
        
        for prop in properties:
            # By category
            cat = prop['category']
            if cat not in by_category:
                by_category[cat] = 0
            by_category[cat] += 1
            
            # By type
            cat_type = prop['category_type']
            by_type[cat_type] += 1
        
        # Get today's new count
        new_today = _get_new_properties_sqlite(date.today()) if db.db_type == 'sqlite' else _get_new_properties_supabase(date.today())
        
        return jsonify({
            'success': True,
            'total_active': total,
            'new_today': len(new_today),
            'by_category': by_category,
            'by_type': by_type,
            'database_type': db.db_type
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

# ================================================================
# Main
# ================================================================

if __name__ == '__main__':
    port: int = config.API_PORT
    host: str = config.API_HOST
    debug: bool = config.API_DEBUG
    
    print(f"\n{'='*70}")
    print(f"うちなーらいふ不動産 API Server")
    print(f"{'='*70}")
    print(f"Database: {db.db_type.upper()}")
    print(f"Server: http://{host}:{port}")
    print(f"Debug Mode: {debug}")
    print(f"{'='*70}\n")
    
    app.run(host=host, port=port, debug=debug)
