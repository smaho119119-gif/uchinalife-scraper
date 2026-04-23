'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Loader2, MapPin } from 'lucide-react';
import { ErrorBanner } from '@/components/ui/error-banner';
import {
    REGIONS,
    SUMAHO119_STORES,
    MAP_CATEGORIES,
    DEFAULT_MAP_CENTER,
    DEFAULT_MAP_ZOOM,
    type SumahoStore,
} from '@/lib/map-config';
import {
    useMapMarkers,
    type PropertyMarker,
} from '@/lib/use-map-markers';
import {
    readMapSession,
    useMapSessionPersistence,
} from '@/lib/use-map-session';

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
    centerCoordinates?: [number, number];
    zoomLevel?: number;
    onStoreClick?: (storeName: string) => void;
}

const MapView = dynamic<MapViewProps>(
    () => import('./MapView').then((mod) => mod.default),
    {
        ssr: false,
        loading: () => (
            <div className="h-[600px] flex items-center justify-center bg-yellow-50 dark:bg-slate-900 rounded-lg border-3 border-slate-900 dark:border-white">
                <Loader2 className="h-8 w-8 animate-spin text-cyan-500" />
            </div>
        ),
    },
);

interface InteractiveMapProps {
    filters?: {
        category?: string;
        categoryType?: string;
        priceRange?: [number, number];
    };
    fullPage?: boolean;
}

/** Snapshot-once initial state from sessionStorage so SSR + initial CSR agree. */
const INITIAL_SESSION =
    typeof window !== 'undefined' ? readMapSession() : null;

export default function InteractiveMap({ filters, fullPage = false }: InteractiveMapProps) {
    const router = useRouter();

    // Markers + remote-island filtering + cache lives in the hook.
    const {
        markers: allMarkers,
        loading,
        error: markersError,
        refetch,
    } = useMapMarkers();

    // UI selection state (kept local; reducer migration deferred to Round 5).
    const [markers, setMarkers] = useState<PropertyMarker[]>([]);
    const [isNavigating, setIsNavigating] = useState(false);
    const [selectedProperty, setSelectedProperty] = useState<PropertyMarker | null>(null);
    const [selectedStore, setSelectedStore] = useState<SumahoStore | null>(() => {
        if (INITIAL_SESSION?.selectedStoreId) {
            return SUMAHO119_STORES.find((s) => s.id === INITIAL_SESSION.selectedStoreId) ?? null;
        }
        return null;
    });
    const [selectedRegion, setSelectedRegion] = useState<string>(
        () => INITIAL_SESSION?.selectedRegion ?? '',
    );
    const [selectedStores, setSelectedStores] = useState<string[]>(
        () => INITIAL_SESSION?.selectedStores ?? [],
    );
    const [mapCenter, setMapCenter] = useState<[number, number] | undefined>(
        () => INITIAL_SESSION?.mapCenter,
    );
    const [mapZoom, setMapZoom] = useState<number | undefined>(
        () => INITIAL_SESSION?.mapZoom,
    );
    const [pendingPropertyId, setPendingPropertyId] = useState<number | null>(
        () => INITIAL_SESSION?.selectedPropertyId ?? null,
    );

    const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
    const [showOnlyActive, setShowOnlyActive] = useState(true);

    // Persist relevant slice to sessionStorage (debounced).
    useMapSessionPersistence(
        useMemo(
            () => ({
                selectedRegion,
                selectedStores,
                selectedStoreId: selectedStore?.id,
                selectedPropertyId: selectedProperty?.id,
                mapCenter,
                mapZoom,
            }),
            [selectedRegion, selectedStores, selectedStore, selectedProperty, mapCenter, mapZoom],
        ),
    );

    // Apply restored region + pending property once data lands.
    useEffect(() => {
        if (loading || allMarkers.length === 0) return;

        if (selectedRegion) {
            if (selectedRegion === '沖縄本島') {
                setMarkers(allMarkers);
            } else {
                const region = REGIONS.find((r) => r.name === selectedRegion);
                if (region && region.cities.length > 0) {
                    setMarkers(
                        allMarkers.filter((m) =>
                            region.cities.some((city) => m.city.includes(city)),
                        ),
                    );
                }
            }
        }

        if (pendingPropertyId) {
            const property = allMarkers.find((m) => m.id === pendingPropertyId);
            if (property) {
                setSelectedProperty(property);
                setSelectedStore(null);
            }
            setPendingPropertyId(null);
        }
    }, [loading, allMarkers, selectedRegion, pendingPropertyId]);

    const handleRegionSelect = (regionName: string) => {
        if (selectedRegion === regionName) {
            setSelectedRegion('');
            setSelectedStores([]);
            setMarkers([]);
            setMapCenter(DEFAULT_MAP_CENTER);
            setMapZoom(DEFAULT_MAP_ZOOM);
            return;
        }

        setSelectedRegion(regionName);
        setSelectedStores([]);

        const region = REGIONS.find((r) => r.name === regionName);
        if (region) {
            setMapCenter(region.center);
            setMapZoom(region.zoom);
        }

        if (regionName === '沖縄本島' || regionName === '') {
            setMarkers(allMarkers);
        } else if (region && region.cities.length > 0) {
            setMarkers(
                allMarkers.filter((m) =>
                    region.cities.some((city) => m.city.includes(city)),
                ),
            );
        }
    };

    const clearRegion = () => {
        setSelectedRegion('');
        setSelectedStores([]);
        setMarkers([]);
        setMapCenter(DEFAULT_MAP_CENTER);
        setMapZoom(DEFAULT_MAP_ZOOM);
    };

    const fitBoundsToStores = (storeIds: string[]) => {
        const stores = storeIds
            .map((id) => SUMAHO119_STORES.find((s) => s.id === id))
            .filter((s): s is SumahoStore => Boolean(s));
        if (stores.length === 0) return;

        if (stores.length === 1) {
            setMapCenter(stores[0].coordinates);
            setMapZoom(14);
            return;
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
        setMapCenter([centerLat, centerLng]);
        setMapZoom(zoom);
    };

    const toggleStore = (storeId: string) => {
        const store = SUMAHO119_STORES.find((s) => s.id === storeId) ?? null;
        const isCurrentlySelected = selectedStores.includes(storeId);

        const next = isCurrentlySelected
            ? selectedStores.filter((id) => id !== storeId)
            : [...selectedStores, storeId];

        if (isCurrentlySelected) {
            if (next.length === 0) {
                setSelectedStore(null);
                setMapCenter(DEFAULT_MAP_CENTER);
                setMapZoom(DEFAULT_MAP_ZOOM);
            } else {
                fitBoundsToStores(next);
            }
        } else if (store) {
            setSelectedStore(store);
            setSelectedProperty(null);
            if (next.length === 1) {
                setMapCenter(store.coordinates);
                setMapZoom(14);
            } else {
                fitBoundsToStores(next);
            }
        }

        setSelectedStores(next);
    };

    const selectAllStores = () => {
        setSelectedStores(SUMAHO119_STORES.map((s) => s.id));
        setMapCenter(DEFAULT_MAP_CENTER);
        setMapZoom(DEFAULT_MAP_ZOOM);
    };

    const handleStoreClick = useCallback((storeName: string) => {
        const store = SUMAHO119_STORES.find((s) => s.name === storeName);
        if (store) {
            setSelectedStore(store);
            setSelectedProperty(null);
        }
    }, []);

    const handlePropertyClick = useCallback(
        (marker: PropertyMarker) => {
            setSelectedProperty(marker);
            setSelectedStore(null);

            if (marker.url) {
                const encodedUrl = encodeURIComponent(marker.url);
                const detailPath = `/properties/${encodedUrl}`;
                router.prefetch(detailPath);
                fetch(`/api/properties/${encodedUrl}`, { cache: 'force-cache' }).catch(() => {});
                fetch('/api/ai/history', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ url: marker.url }),
                    cache: 'force-cache',
                }).catch(() => {});
            }
        },
        [router],
    );

    const filteredMarkers = useMemo(() => {
        return markers.filter((marker) => {
            if (filters?.category && marker.category !== filters.category) return false;
            if (filters?.categoryType && marker.categoryType !== filters.categoryType) return false;

            if (selectedCategories.length > 0) {
                const matches = selectedCategories.some((catId) => {
                    const cat = MAP_CATEGORIES.find((c) => c.id === catId);
                    if (!cat) return false;
                    if (cat.type === '賃貸') return marker.categoryType === '賃貸';
                    if (catId === 'buy_house') return marker.genreName?.includes('戸建');
                    if (catId === 'buy_mansion') return marker.genreName?.includes('マンション');
                    if (catId === 'buy_land') return marker.genreName?.includes('土地');
                    return false;
                });
                if (!matches) return false;
            }
            return true;
        });
    }, [markers, filters?.category, filters?.categoryType, selectedCategories]);

    const toggleCategory = (catId: string) => {
        setSelectedCategories((prev) =>
            prev.includes(catId) ? prev.filter((id) => id !== catId) : [...prev, catId],
        );
    };

    const selectedStoreLocations = useMemo(
        () => SUMAHO119_STORES.filter((store) => selectedStores.includes(store.id)),
        [selectedStores],
    );

    const containerHeight = fullPage ? 'h-[calc(100vh-100px)]' : 'h-[500px]';

    return (
        <div className={`flex gap-2 ${containerHeight}`}>
            {/* Sidebar */}
            <div className="w-36 flex-shrink-0 flex flex-col gap-2 h-full">
                {/* Categories */}
                <div className="p-2 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg border border-indigo-200 dark:border-indigo-700 flex-shrink-0">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-indigo-700 dark:text-indigo-400">🏷️ カテゴリ</span>
                        {selectedCategories.length > 0 && (
                            <button
                                type="button"
                                onClick={() => setSelectedCategories([])}
                                className="text-xs text-rose-500 hover:text-rose-600"
                                aria-label="カテゴリ選択を全て解除"
                            >
                                ✕
                            </button>
                        )}
                    </div>
                    <div className="grid grid-cols-2 gap-1">
                        {MAP_CATEGORIES.map((cat) => (
                            <button
                                type="button"
                                key={cat.id}
                                onClick={() => toggleCategory(cat.id)}
                                aria-pressed={selectedCategories.includes(cat.id)}
                                className={`text-[10px] px-1.5 py-1 rounded border transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 ${
                                    selectedCategories.includes(cat.id)
                                        ? 'bg-indigo-500 text-white border-indigo-500'
                                        : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-300 dark:border-slate-600 hover:border-indigo-400'
                                }`}
                            >
                                {cat.label.replace('売買', '')}
                            </button>
                        ))}
                    </div>
                    <div className="mt-2 pt-2 border-t border-indigo-200 dark:border-indigo-700">
                        <label className="flex items-center gap-1.5 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={showOnlyActive}
                                onChange={(e) => setShowOnlyActive(e.target.checked)}
                                className="w-3 h-3 rounded border-slate-300 text-indigo-500 focus:ring-indigo-500"
                            />
                            <span className="text-[10px] text-slate-600 dark:text-slate-400">
                                販売中のみ
                            </span>
                        </label>
                    </div>
                    <div className="mt-1 text-center">
                        <span className="text-[10px] text-indigo-500">
                            {filteredMarkers.length}件表示
                        </span>
                    </div>
                </div>

                {/* Region */}
                <div className="p-2 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 flex-shrink-0 overflow-hidden">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-slate-700 dark:text-slate-300">📍 地域</span>
                        <button
                            type="button"
                            onClick={clearRegion}
                            className="text-xs text-rose-500 hover:text-rose-600"
                            aria-label="地域選択を解除"
                        >
                            ✕
                        </button>
                    </div>
                    <div className="flex flex-col gap-1 overflow-hidden">
                        {REGIONS.map((region) => (
                            <Button
                                key={region.name}
                                onClick={() => handleRegionSelect(region.name)}
                                variant={selectedRegion === region.name ? 'default' : 'outline'}
                                size="sm"
                                className={`h-6 w-full text-xs justify-start px-2 transform-none hover:scale-100 ${
                                    selectedRegion === region.name
                                        ? 'bg-cyan-500 hover:bg-cyan-600'
                                        : 'border-slate-300 dark:border-slate-600'
                                }`}
                            >
                                {region.name}
                            </Button>
                        ))}
                    </div>
                </div>

                {/* Stores */}
                <div className="p-2 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-700 flex-1 flex flex-col min-h-0 overflow-hidden">
                    <div className="flex items-center justify-between mb-2 flex-shrink-0">
                        <span className="text-xs font-bold text-amber-700 dark:text-amber-400">
                            📱 店舗 ({SUMAHO119_STORES.length})
                        </span>
                        <button
                            type="button"
                            onClick={selectAllStores}
                            className="text-xs text-amber-600 hover:text-amber-700"
                        >
                            全
                        </button>
                    </div>
                    <div className="flex flex-col gap-1 overflow-y-auto overflow-x-hidden flex-1 pr-1">
                        {SUMAHO119_STORES.map((store) => (
                            <Button
                                key={store.id}
                                onClick={() => toggleStore(store.id)}
                                variant={selectedStores.includes(store.id) ? 'default' : 'outline'}
                                size="sm"
                                className={`h-6 w-full text-xs justify-start px-2 flex-shrink-0 transform-none hover:scale-100 ${
                                    selectedStores.includes(store.id)
                                        ? 'bg-amber-500 hover:bg-amber-600'
                                        : 'border-amber-300 dark:border-amber-600 text-amber-600 dark:text-amber-400'
                                }`}
                            >
                                {store.name}
                            </Button>
                        ))}
                    </div>
                    {selectedStores.length > 0 && (
                        <button
                            type="button"
                            onClick={() => {
                                setSelectedStores([]);
                                setSelectedStore(null);
                            }}
                            className="w-full mt-2 text-xs text-rose-500 hover:text-rose-600 flex-shrink-0 border-t border-amber-200 pt-2"
                        >
                            ✕ クリア ({selectedStores.length}件)
                        </button>
                    )}
                </div>
            </div>

            {/* Map */}
            <div className="flex-1 h-full">
                {markersError ? (
                    <div className="p-4">
                        <ErrorBanner message={markersError} onRetry={refetch} />
                    </div>
                ) : loading ? (
                    <div className="h-full flex items-center justify-center bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
                        <div className="text-center">
                            <Loader2 className="h-8 w-8 animate-spin text-cyan-500 mx-auto mb-2" />
                            <p className="text-sm text-slate-600 dark:text-slate-400">
                                読み込み中...
                            </p>
                        </div>
                    </div>
                ) : (
                    <div className="h-full">
                        <MapView
                            markers={filteredMarkers}
                            onMarkerClick={handlePropertyClick}
                            selectedRegion={selectedRegion}
                            stores={selectedStoreLocations}
                            centerCoordinates={mapCenter}
                            zoomLevel={mapZoom}
                            onStoreClick={handleStoreClick}
                        />
                    </div>
                )}
            </div>

            {/* Info Panel */}
            <div className="w-64 flex-shrink-0 h-full">
                {selectedProperty ? (
                    <div className="h-full overflow-y-auto p-3 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
                        <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-2 line-clamp-2">
                            {selectedProperty.title}
                        </h3>
                        {selectedProperty.image && (
                            <div className="relative w-full h-28 rounded-lg mb-2 bg-slate-200 dark:bg-slate-700 overflow-hidden">
                                <img
                                    src={selectedProperty.image}
                                    alt={selectedProperty.title}
                                    loading="eager"
                                    decoding="async"
                                    className="w-full h-full object-cover animate-fade-in"
                                    onError={(e) => {
                                        (e.target as HTMLImageElement).style.display = 'none';
                                    }}
                                />
                            </div>
                        )}
                        <div className="space-y-1.5 text-sm">
                            <div className="flex justify-between">
                                <span className="text-slate-500 text-xs">カテゴリー</span>
                                <span className="font-semibold text-slate-900 dark:text-white text-xs">
                                    {selectedProperty.genreName}
                                </span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-slate-500 text-xs">価格</span>
                                <span className="font-bold text-cyan-600 text-xs">
                                    {selectedProperty.price}
                                </span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-slate-500 text-xs">タイプ</span>
                                <span className="font-semibold text-slate-900 dark:text-white text-xs">
                                    {selectedProperty.categoryType}
                                </span>
                            </div>
                            <div className="pt-1.5 border-t border-slate-200 dark:border-slate-600">
                                <span className="text-slate-500 text-xs">所在地</span>
                                <p className="text-slate-900 dark:text-white font-medium text-xs mt-0.5">
                                    {selectedProperty.location}
                                </p>
                            </div>
                        </div>

                        <button
                            type="button"
                            onClick={() => {
                                setIsNavigating(true);
                                router.push(
                                    `/properties/${encodeURIComponent(selectedProperty.url)}`,
                                );
                            }}
                            onMouseEnter={() => {
                                const path = `/properties/${encodeURIComponent(selectedProperty.url)}`;
                                router.prefetch(path);
                                fetch(`/api/properties/${encodeURIComponent(selectedProperty.url)}`, {
                                    cache: 'force-cache',
                                }).catch(() => {});
                            }}
                            onTouchStart={() => {
                                const path = `/properties/${encodeURIComponent(selectedProperty.url)}`;
                                router.prefetch(path);
                            }}
                            disabled={isNavigating}
                            aria-label={`${selectedProperty.title} の詳細を開く`}
                            className={`mt-3 w-full flex items-center justify-center gap-2 text-white font-bold py-2 px-3 rounded-lg transition-colors text-sm cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 ${
                                isNavigating
                                    ? 'bg-cyan-400 cursor-wait'
                                    : 'bg-cyan-500 hover:bg-cyan-600'
                            }`}
                        >
                            {isNavigating ? (
                                <>
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    読み込み中...
                                </>
                            ) : (
                                '📋 詳細を見る'
                            )}
                        </button>
                    </div>
                ) : selectedStore ? (
                    <div className="h-full overflow-y-auto p-3 bg-amber-50 dark:bg-amber-900/30 rounded-lg border border-amber-200 dark:border-amber-700">
                        <div className="relative w-full h-32 rounded-lg overflow-hidden border-2 border-amber-300 mb-3">
                            <iframe
                                title={`${selectedStore.name}の地図`}
                                width="100%"
                                height="100%"
                                style={{ border: 0 }}
                                loading="lazy"
                                src={`https://www.openstreetmap.org/export/embed.html?bbox=${selectedStore.coordinates[1] - 0.005}%2C${selectedStore.coordinates[0] - 0.003}%2C${selectedStore.coordinates[1] + 0.005}%2C${selectedStore.coordinates[0] + 0.003}&layer=mapnik&marker=${selectedStore.coordinates[0]}%2C${selectedStore.coordinates[1]}`}
                            />
                            <div className="absolute bottom-1 right-1 bg-amber-500 text-white text-xs px-2 py-0.5 rounded font-bold">
                                📍 {selectedStore.name}
                            </div>
                        </div>

                        <div className="text-center mb-3">
                            <h3 className="text-base font-bold text-amber-700 dark:text-amber-400">
                                📱 スマホ119 {selectedStore.name}
                                {selectedStore.subtitle}
                            </h3>
                        </div>

                        <div className="space-y-2 text-sm">
                            <div className="bg-white dark:bg-slate-800 rounded p-2">
                                <span className="text-amber-600 text-xs font-bold">📍 住所</span>
                                <p className="text-slate-900 dark:text-white mt-1 text-xs">
                                    {selectedStore.address}
                                </p>
                            </div>
                            <div className="bg-white dark:bg-slate-800 rounded p-2">
                                <span className="text-amber-600 text-xs font-bold">🕐 営業時間</span>
                                <p className="text-slate-900 dark:text-white mt-1">10:00 - 19:00</p>
                            </div>
                            <div className="bg-white dark:bg-slate-800 rounded p-2">
                                <span className="text-amber-600 text-xs font-bold">📞 電話</span>
                                <p className="text-slate-900 dark:text-white mt-1">0120-119-119</p>
                            </div>
                        </div>

                        <a
                            href={selectedStore.googleMapsUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-3 w-full flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-600 text-white font-bold py-2 px-4 rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
                        >
                            🗺️ Googleマップで見る
                        </a>
                    </div>
                ) : (
                    <div className="h-full flex items-center justify-center bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
                        <div className="text-center p-4">
                            <MapPin className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                            <p className="text-slate-500 text-sm font-medium">マーカーを選択</p>
                            <p className="text-slate-400 text-xs mt-1">
                                詳細情報が表示されます
                            </p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
