"""
API Server for うちなーらいふ不動産スクレイピングシステム
Provides REST API endpoints for property data
"""

from flask import Flask, jsonify, request, send_from_directory, Response
from flask_cors import CORS
from database import db
from datetime import datetime, date, timedelta
from typing import Tuple, Dict, Any, List
import os
from config import config

app = Flask(__name__, static_folder='.')
CORS(app)

# ================================================================
# Static file serving
# ================================================================

@app.route('/')
def index():
    """Serve the main HTML page"""
    return send_from_directory('.', 'index.html')

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
    Get all active properties
    Query params:
      - category: Filter by category (optional)
      - category_type: Filter by category type 賃貸/売買 (optional)
      - limit: Limit number of results (optional)
    """
    try:
        # Get all active properties from database
        properties = db.get_all_active_properties()
        
        # Apply filters
        category = request.args.get('category')
        category_type = request.args.get('category_type')
        limit = request.args.get('limit', type=int)
        
        if category:
            properties = [p for p in properties if p['category'] == category]
        
        if category_type:
            properties = [p for p in properties if p['category_type'] == category_type]
        
        if limit:
            properties = properties[:limit]
        
        return jsonify({
            'success': True,
            'count': len(properties),
            'data': properties
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/properties/new', methods=['GET'])
def get_new_properties():
    """
    Get properties added today (or specific date)
    Query params:
      - date: Date in YYYY-MM-DD format (optional, defaults to today)
      - category: Filter by category (optional)
    """
    try:
        target_date = request.args.get('date')
        if target_date:
            target_date = datetime.strptime(target_date, '%Y-%m-%d').date()
        else:
            target_date = date.today()
        
        # Query properties by first_seen_date
        if db.db_type == 'sqlite':
            properties = _get_new_properties_sqlite(target_date)
        else:
            properties = _get_new_properties_supabase(target_date)
        
        # Apply category filter
        category = request.args.get('category')
        if category:
            properties = [p for p in properties if p['category'] == category]
        
        return jsonify({
            'success': True,
            'date': target_date.isoformat(),
            'count': len(properties),
            'data': properties
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

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
    Get recently sold/removed properties
    Query params:
      - days: Number of days to look back (default: 7)
      - category: Filter by category (optional)
    """
    try:
        days_back = request.args.get('days', default=7, type=int)
        cutoff_date = (date.today() - timedelta(days=days_back)).isoformat()
        
        # Query inactive properties
        if db.db_type == 'sqlite':
            properties = _get_sold_properties_sqlite(cutoff_date)
        else:
            properties = _get_sold_properties_supabase(cutoff_date)
        
        # Apply category filter
        category = request.args.get('category')
        if category:
            properties = [p for p in properties if p['category'] == category]
        
        return jsonify({
            'success': True,
            'days_back': days_back,
            'count': len(properties),
            'data': properties
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

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

@app.route('/api/stats/advanced', methods=['GET'])
def get_advanced_stats():
    """
    Get comprehensive statistics with price analysis, trends, and area distribution
    """
    try:
        # Get all active properties count
        all_props = db.get_all_active_properties()
        total_active = len(all_props)
        
        # Get time-based statistics
        time_stats = db.get_time_based_statistics()
        
        # Get category statistics
        cat_stats = db.get_category_statistics()
        
        # Get price statistics
        price_stats = db.get_price_statistics()
        
        # Get area distribution
        area_dist = db.get_area_distribution()
        
        # Calculate counts by type
        by_type = {}
        for cat in cat_stats.values():
            cat_type = cat['category_type']
            by_type[cat_type] = by_type.get(cat_type, 0) + cat['count']
        
        return jsonify({
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
                'max_raw': price_stats['max']
            },
            'by_category': cat_stats,
            'by_type': by_type,
            'by_area': area_dist,
            'database_type': db.db_type
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }),500
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
