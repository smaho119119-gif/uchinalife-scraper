'use client';

import { useEffect, useRef } from 'react';

const MAP_STATE_KEY = 'mapState';
const SAVE_DEBOUNCE_MS = 500;

export interface MapSessionState {
    selectedRegion: string;
    selectedStores: string[];
    selectedStoreId?: string;
    selectedPropertyId?: number;
    mapCenter?: [number, number];
    mapZoom?: number;
}

/** Read-once helper for hydrating initial state on the client. */
export function readMapSession(): MapSessionState | null {
    if (typeof window === 'undefined') return null;
    try {
        const raw = sessionStorage.getItem(MAP_STATE_KEY);
        return raw ? (JSON.parse(raw) as MapSessionState) : null;
    } catch {
        return null;
    }
}

/**
 * Debounced sessionStorage persistence for the map. Persists `state`
 * 500ms after the last change, and clears the timer on unmount.
 *
 * Keeping this isolated lets InteractiveMap stay focused on UI logic and
 * prevents the persistence effect from re-running on every render.
 */
export function useMapSessionPersistence(state: MapSessionState): void {
    const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        timeoutRef.current = setTimeout(() => {
            try {
                sessionStorage.setItem(MAP_STATE_KEY, JSON.stringify(state));
            } catch {
                // sessionStorage may be unavailable (private mode, quota); fail silent
            }
        }, SAVE_DEBOUNCE_MS);
        return () => {
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
        };
    }, [state]);
}
