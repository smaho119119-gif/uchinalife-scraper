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
