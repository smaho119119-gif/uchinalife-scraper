"use client";

import { useEffect, useRef, memo } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

interface PropertyMarker {
    id: number;
    url: string;
    title: string;
    category: string;
    categoryType: string;
    genreName: string;
    location: string;
    city: string;
    price: string;
    image: string | null;
    coordinates: [number, number];
}

interface StoreLocation {
    name: string;
    address: string;
    coordinates: [number, number];
}

interface MapViewProps {
    markers: PropertyMarker[];
    onMarkerClick?: (marker: PropertyMarker) => void;
    selectedRegion?: string;
    stores?: StoreLocation[];
    centerCoordinates?: [number, number]; // マップの中心座標
    zoomLevel?: number; // ズームレベル
    onStoreClick?: (storeName: string) => void; // 店舗クリック時のコールバック
}

// Category colors
const categoryColors: Record<string, string> = {
    'house': '#ef4444',    // red
    'mansion': '#3b82f6',  // blue
    'tochi': '#10b981',    // green
    'jukyo': '#8b5cf6',    // purple
    'jigyo': '#f59e0b',    // amber
    'parking': '#06b6d4',  // cyan
    'sonota': '#6b7280',   // gray
    'yard': '#84cc16'      // lime
};

// MapView component - displays property markers and store locations on Leaflet map
// React.memoで不要な再レンダリングを防止
const MapView = memo(function MapView({ markers, onMarkerClick, stores = [], centerCoordinates, zoomLevel, onStoreClick }: MapViewProps) {
    const mapRef = useRef<L.Map | null>(null);
    const mapContainerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!mapContainerRef.current || mapRef.current) return;

        // Initialize map centered on Okinawa
        const map = L.map(mapContainerRef.current).setView([26.3344, 127.8056], 10);
        mapRef.current = map;

        // Add tile layer
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors',
            maxZoom: 18,
        }).addTo(map);

        return () => {
            if (mapRef.current) {
                mapRef.current.remove();
                mapRef.current = null;
            }
        };
    }, []);

    // 中心座標が変更されたときにマップを移動（アニメーション付き）
    useEffect(() => {
        if (mapRef.current && centerCoordinates) {
            mapRef.current.flyTo(centerCoordinates, zoomLevel || 14, {
                duration: 1.0, // アニメーション時間（秒）
                easeLinearity: 0.25
            });
        }
    }, [centerCoordinates, zoomLevel]);

    // 店舗が変更されたときに全店舗が見えるようにアニメーション
    useEffect(() => {
        if (!mapRef.current || stores.length === 0) return;

        // 少し遅延を入れてマーカーが追加された後にboundsを調整
        const timer = setTimeout(() => {
            if (stores.length >= 2 && mapRef.current) {
                const bounds = L.latLngBounds(stores.map(s => s.coordinates));
                mapRef.current.flyToBounds(bounds, {
                    padding: [50, 50],
                    maxZoom: 13,
                    duration: 1.0
                });
            }
        }, 100);

        return () => clearTimeout(timer);
    }, [stores]);

    useEffect(() => {
        if (!mapRef.current) return;

        // Clear existing markers
        mapRef.current.eachLayer((layer) => {
            if (layer instanceof L.Marker) {
                mapRef.current!.removeLayer(layer);
            }
        });

        // Limit markers for performance
        const maxMarkers = 200;
        const markersToShow = markers.slice(0, maxMarkers);

        // Add markers in batches for better performance
        // 最初のバッチを大きくして初期表示を高速化
        const firstBatchSize = 100;
        const batchSize = 50;
        let currentBatch = 0;

        const addMarkerBatch = () => {
            // 最初のバッチは大きく、残りは小さく
            const currentBatchSize = currentBatch === 0 ? firstBatchSize : batchSize;
            const start = currentBatch === 0 ? 0 : firstBatchSize + (currentBatch - 1) * batchSize;
            const end = Math.min(start + currentBatchSize, markersToShow.length);

            for (let i = start; i < end; i++) {
                const marker = markersToShow[i];
                if (!marker.coordinates) continue;

                const color = categoryColors[marker.category] || '#6b7280';

                // Simplified icon for better performance
                const icon = L.divIcon({
                    className: 'custom-marker',
                    html: `
          <div style="
            background-color: ${color};
            width: 28px;
            height: 28px;
            border-radius: 50% 50% 50% 0;
            transform: rotate(-45deg);
            border: 2px solid white;
            box-shadow: 0 1px 4px rgba(0,0,0,0.3);
          ">
            <div style="transform: rotate(45deg); color: white; font-size: 14px; font-weight: bold; text-align: center; line-height: 24px;">
              ${marker.categoryType === '賃貸' ? '賃' : '売'}
            </div>
          </div>
        `,
                    iconSize: [28, 28],
                    iconAnchor: [14, 28],
                });

                const leafletMarker = L.marker(marker.coordinates, { icon })
                    .addTo(mapRef.current!)
                    .bindPopup(`
          <div style="min-width: 180px; max-width: 250px;">
            <h3 style="font-weight: bold; margin-bottom: 6px; color: #1e293b; font-size: 14px;">${marker.title}</h3>
            ${marker.image ? `<img src="${marker.image}" alt="${marker.title}" style="width: 100%; height: 100px; object-fit: cover; border-radius: 4px; margin-bottom: 6px;" loading="lazy" />` : ''}
            <p style="margin: 3px 0; color: #475569; font-size: 12px;"><strong>カテゴリー:</strong> ${marker.genreName}</p>
            <p style="margin: 3px 0; color: #475569; font-size: 12px;"><strong>価格:</strong> ${marker.price}</p>
            <p style="margin: 3px 0; color: #475569; font-size: 12px;"><strong>所在地:</strong> ${marker.location}</p>
          </div>
        `);

                leafletMarker.on('click', () => {
                    if (onMarkerClick) {
                        onMarkerClick(marker);
                    }
                });
            }

            currentBatch++;

            // Add next batch if there are more markers
            if (end < markersToShow.length) {
                requestAnimationFrame(addMarkerBatch);
            } else {
                // Add store markers after all property markers are added
                stores.forEach((store) => {
                    const storeIcon = L.divIcon({
                        className: 'store-marker',
                        html: `
              <div style="
                background-color: #f59e0b;
                width: 36px;
                height: 36px;
                border-radius: 50%;
                border: 4px solid #d97706;
                box-shadow: 0 2px 8px rgba(0,0,0,0.4);
                display: flex;
                align-items: center;
                justify-content: center;
              ">
                <div style="color: white; font-size: 18px; font-weight: bold;">
                  📱
                </div>
              </div>
            `,
                        iconSize: [36, 36],
                        iconAnchor: [18, 18],
                    });

                    const storeMarker = L.marker(store.coordinates, { icon: storeIcon })
                        .addTo(mapRef.current!)
                        .bindPopup(`
              <div style="min-width: 200px;">
                <h3 style="font-weight: bold; margin-bottom: 6px; color: #d97706; font-size: 16px;">📱 スマホ119 ${store.name}</h3>
                <p style="margin: 4px 0; color: #475569; font-size: 13px;"><strong>住所:</strong> ${store.address}</p>
                <p style="margin: 4px 0; color: #d97706; font-size: 12px; font-weight: bold;">営業時間: 10:00-19:00</p>
              </div>
            `);

                    // 店舗クリック時のコールバック
                    storeMarker.on('click', () => {
                        if (onStoreClick) {
                            onStoreClick(store.name);
                        }
                    });
                });

                // Fit bounds after all markers are added
                if (markersToShow.length > 0) {
                    const bounds = L.latLngBounds(markersToShow.map(m => m.coordinates));
                    mapRef.current!.fitBounds(bounds, { padding: [50, 50], maxZoom: 13 });
                }
            }
        };

        // Start adding markers
        requestAnimationFrame(addMarkerBatch);

    }, [markers, onMarkerClick, stores, onStoreClick]);

    return (
        <div
            ref={mapContainerRef}
            className="h-full w-full rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700"
            style={{ zIndex: 0, minHeight: '300px' }}
        />
    );
});

export default MapView;
