'use client';

import { useCallback, useEffect, useState } from 'react';
import { REMOTE_ISLANDS } from '@/lib/map-config';

export interface PropertyMarker {
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

interface CacheSlot {
    markers: PropertyMarker[] | null;
    timestamp: number;
}

/**
 * Module-level cache (per browser tab) so navigating away and back to the
 * map doesn't refetch the marker payload. Five-minute TTL is intentional —
 * fresh enough for sales work, slow enough to avoid hammering the API.
 */
const moduleCache: CacheSlot = { markers: null, timestamp: 0 };
const CACHE_TTL_MS = 5 * 60 * 1000;

interface UseMapMarkersResult {
    markers: PropertyMarker[];
    loading: boolean;
    error: string | null;
    refetch: () => void;
}

/**
 * Fetch the property markers shown on the map.
 *
 * - Uses an in-tab cache (5 min TTL) for instant return after navigation.
 * - Filters out remote islands so the main-island view stays focused.
 * - Returns `loading=false` immediately if the cache is warm.
 * - Errors surface via `error` so the caller can render an inline message.
 */
export function useMapMarkers(): UseMapMarkersResult {
    const [markers, setMarkers] = useState<PropertyMarker[]>(() => moduleCache.markers ?? []);
    const [loading, setLoading] = useState(() => !moduleCache.markers);
    const [error, setError] = useState<string | null>(null);
    const [tick, setTick] = useState(0);

    const refetch = useCallback(() => {
        moduleCache.markers = null;
        moduleCache.timestamp = 0;
        setTick((t) => t + 1);
    }, []);

    useEffect(() => {
        const now = Date.now();
        if (
            moduleCache.markers &&
            now - moduleCache.timestamp < CACHE_TTL_MS
        ) {
            setMarkers(moduleCache.markers);
            setLoading(false);
            setError(null);
            return;
        }

        let cancelled = false;
        const ctrl = new AbortController();

        (async () => {
            setLoading(true);
            setError(null);
            try {
                const res = await fetch('/api/properties/locations?limit=500', {
                    signal: ctrl.signal,
                });
                if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
                const data = await res.json();
                if (cancelled) return;
                if (!data?.success) {
                    throw new Error(data?.error || 'マーカーの取得に失敗しました');
                }
                const mainland: PropertyMarker[] = (data.markers ?? []).filter(
                    (m: PropertyMarker) =>
                        !REMOTE_ISLANDS.some((island) => m.city?.includes(island)),
                );
                moduleCache.markers = mainland;
                moduleCache.timestamp = Date.now();
                setMarkers(mainland);
            } catch (err) {
                if (cancelled || (err instanceof Error && err.name === 'AbortError')) return;
                const msg = err instanceof Error ? err.message : 'マーカーの取得に失敗しました';
                setError(msg);
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();

        return () => {
            cancelled = true;
            ctrl.abort();
        };
    }, [tick]);

    return { markers, loading, error, refetch };
}
