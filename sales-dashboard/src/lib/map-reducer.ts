/**
 * Pure reducer + action types for the InteractiveMap UI state.
 *
 * Why a reducer here:
 * - The previous component used 11 useState calls. Operations like
 *   "select region" or "toggle store" had to update 4-5 of them in
 *   coordinated ways, which made race conditions and forgotten updates easy.
 * - Centralising the state machine here lets the component become a thin
 *   shell that just dispatches semantic actions.
 *
 * The reducer is intentionally pure: anything that calls fetch / sessionStorage
 * stays in the component or the dedicated hooks (useMapMarkers, useMapSession).
 */

import {
    DEFAULT_MAP_CENTER,
    DEFAULT_MAP_ZOOM,
    REGIONS,
    SUMAHO119_STORES,
    type SumahoStore,
} from '@/lib/map-config';
import type { PropertyMarker } from '@/lib/use-map-markers';

export interface MapState {
    /** Markers visible after region filtering (before category filtering). */
    markers: PropertyMarker[];
    /** Property card open in the right info panel. */
    selectedProperty: PropertyMarker | null;
    /** Store card open in the right info panel. */
    selectedStore: SumahoStore | null;
    /** Currently active region (empty = none). */
    selectedRegion: string;
    /** Selected store id list (multi-select). */
    selectedStores: string[];
    /** Map view position. Undefined = let MapView decide. */
    mapCenter: [number, number] | undefined;
    mapZoom: number | undefined;
    /** Category filter chips. */
    selectedCategories: string[];
    /** Whether to restrict to active properties. */
    showOnlyActive: boolean;
    /** True while we navigate to the property detail page. */
    isNavigating: boolean;
    /** Property id we want to re-select once data loads (session restore). */
    pendingPropertyId: number | null;
}

export type MapAction =
    | { type: 'SELECT_REGION'; region: string; allMarkers: PropertyMarker[] }
    | { type: 'CLEAR_REGION' }
    | { type: 'TOGGLE_STORE'; storeId: string }
    | { type: 'CLEAR_STORES' }
    | { type: 'SELECT_ALL_STORES' }
    | { type: 'SELECT_PROPERTY'; marker: PropertyMarker | null }
    | { type: 'SELECT_STORE_BY_NAME'; name: string }
    | { type: 'TOGGLE_CATEGORY'; categoryId: string }
    | { type: 'CLEAR_CATEGORIES' }
    | { type: 'SET_SHOW_ONLY_ACTIVE'; value: boolean }
    | { type: 'SET_NAVIGATING'; value: boolean }
    | { type: 'HYDRATE_FROM_DATA'; allMarkers: PropertyMarker[] }
    | { type: 'CLEAR_PENDING_PROPERTY' };

export function createInitialMapState(opts: {
    selectedRegion?: string;
    selectedStores?: string[];
    selectedStoreId?: string;
    selectedPropertyId?: number;
    mapCenter?: [number, number];
    mapZoom?: number;
}): MapState {
    const initialStore =
        opts.selectedStoreId
            ? SUMAHO119_STORES.find((s) => s.id === opts.selectedStoreId) ?? null
            : null;
    return {
        markers: [],
        selectedProperty: null,
        selectedStore: initialStore,
        selectedRegion: opts.selectedRegion ?? '',
        selectedStores: opts.selectedStores ?? [],
        mapCenter: opts.mapCenter,
        mapZoom: opts.mapZoom,
        selectedCategories: [],
        showOnlyActive: true,
        isNavigating: false,
        pendingPropertyId: opts.selectedPropertyId ?? null,
    };
}

/** Filter `allMarkers` by region cities (or return all for `沖縄本島`). */
function filterByRegion(allMarkers: PropertyMarker[], regionName: string): PropertyMarker[] {
    if (!regionName) return [];
    if (regionName === '沖縄本島') return allMarkers;
    const region = REGIONS.find((r) => r.name === regionName);
    if (!region || region.cities.length === 0) return [];
    return allMarkers.filter((m) =>
        region.cities.some((city) => m.city.includes(city)),
    );
}

/** Compute fit-bounds center+zoom for a set of stores. */
function computeStoreBounds(storeIds: string[]): { center: [number, number]; zoom: number } {
    const stores = storeIds
        .map((id) => SUMAHO119_STORES.find((s) => s.id === id))
        .filter((s): s is SumahoStore => Boolean(s));
    if (stores.length === 0) {
        return { center: DEFAULT_MAP_CENTER, zoom: DEFAULT_MAP_ZOOM };
    }
    if (stores.length === 1) {
        return { center: stores[0].coordinates, zoom: 14 };
    }
    const lats = stores.map((s) => s.coordinates[0]);
    const lngs = stores.map((s) => s.coordinates[1]);
    const centerLat = (Math.min(...lats) + Math.max(...lats)) / 2;
    const centerLng = (Math.min(...lngs) + Math.max(...lngs)) / 2;
    const maxDiff = Math.max(
        Math.max(...lats) - Math.min(...lats),
        Math.max(...lngs) - Math.min(...lngs),
    );
    let zoom = 10;
    if (maxDiff < 0.05) zoom = 14;
    else if (maxDiff < 0.1) zoom = 13;
    else if (maxDiff < 0.2) zoom = 12;
    else if (maxDiff < 0.5) zoom = 11;
    return { center: [centerLat, centerLng], zoom };
}

export function mapReducer(state: MapState, action: MapAction): MapState {
    switch (action.type) {
        case 'SELECT_REGION': {
            // Same region → toggle off (clear filters + return to default view).
            if (state.selectedRegion === action.region) {
                return {
                    ...state,
                    selectedRegion: '',
                    selectedStores: [],
                    markers: [],
                    mapCenter: DEFAULT_MAP_CENTER,
                    mapZoom: DEFAULT_MAP_ZOOM,
                };
            }
            const region = REGIONS.find((r) => r.name === action.region);
            return {
                ...state,
                selectedRegion: action.region,
                selectedStores: [],
                markers: filterByRegion(action.allMarkers, action.region),
                mapCenter: region?.center ?? state.mapCenter,
                mapZoom: region?.zoom ?? state.mapZoom,
            };
        }
        case 'CLEAR_REGION':
            return {
                ...state,
                selectedRegion: '',
                selectedStores: [],
                markers: [],
                mapCenter: DEFAULT_MAP_CENTER,
                mapZoom: DEFAULT_MAP_ZOOM,
            };
        case 'TOGGLE_STORE': {
            const isCurrentlySelected = state.selectedStores.includes(action.storeId);
            const next = isCurrentlySelected
                ? state.selectedStores.filter((id) => id !== action.storeId)
                : [...state.selectedStores, action.storeId];
            const store = SUMAHO119_STORES.find((s) => s.id === action.storeId) ?? null;

            if (isCurrentlySelected) {
                if (next.length === 0) {
                    return {
                        ...state,
                        selectedStores: next,
                        selectedStore: null,
                        mapCenter: DEFAULT_MAP_CENTER,
                        mapZoom: DEFAULT_MAP_ZOOM,
                    };
                }
                const bounds = computeStoreBounds(next);
                return { ...state, selectedStores: next, mapCenter: bounds.center, mapZoom: bounds.zoom };
            }

            // Newly selected
            const view =
                next.length === 1 && store
                    ? { center: store.coordinates, zoom: 14 }
                    : computeStoreBounds(next);
            return {
                ...state,
                selectedStores: next,
                selectedStore: store ?? state.selectedStore,
                selectedProperty: store ? null : state.selectedProperty,
                mapCenter: view.center,
                mapZoom: view.zoom,
            };
        }
        case 'CLEAR_STORES':
            return {
                ...state,
                selectedStores: [],
                selectedStore: null,
            };
        case 'SELECT_ALL_STORES':
            return {
                ...state,
                selectedStores: SUMAHO119_STORES.map((s) => s.id),
                mapCenter: DEFAULT_MAP_CENTER,
                mapZoom: DEFAULT_MAP_ZOOM,
            };
        case 'SELECT_PROPERTY':
            return {
                ...state,
                selectedProperty: action.marker,
                selectedStore: action.marker ? null : state.selectedStore,
            };
        case 'SELECT_STORE_BY_NAME': {
            const store = SUMAHO119_STORES.find((s) => s.name === action.name);
            if (!store) return state;
            return { ...state, selectedStore: store, selectedProperty: null };
        }
        case 'TOGGLE_CATEGORY': {
            const next = state.selectedCategories.includes(action.categoryId)
                ? state.selectedCategories.filter((id) => id !== action.categoryId)
                : [...state.selectedCategories, action.categoryId];
            return { ...state, selectedCategories: next };
        }
        case 'CLEAR_CATEGORIES':
            return { ...state, selectedCategories: [] };
        case 'SET_SHOW_ONLY_ACTIVE':
            return { ...state, showOnlyActive: action.value };
        case 'SET_NAVIGATING':
            return { ...state, isNavigating: action.value };
        case 'HYDRATE_FROM_DATA': {
            // Apply the restored region filter once data lands. If a property id
            // was pending from session restore, surface it as the selection.
            const filtered = state.selectedRegion
                ? filterByRegion(action.allMarkers, state.selectedRegion)
                : state.markers;
            const restoredProperty = state.pendingPropertyId
                ? action.allMarkers.find((m) => m.id === state.pendingPropertyId) ?? null
                : null;
            return {
                ...state,
                markers: filtered,
                selectedProperty: restoredProperty ?? state.selectedProperty,
                selectedStore: restoredProperty ? null : state.selectedStore,
                pendingPropertyId: null,
            };
        }
        case 'CLEAR_PENDING_PROPERTY':
            return { ...state, pendingPropertyId: null };
        default:
            return state;
    }
}
