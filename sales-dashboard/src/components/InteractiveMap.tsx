"use client";

import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Loader2, MapPin } from 'lucide-react';

// グローバルキャッシュ（ページ遷移しても保持される）
const globalCache = {
    markers: null as PropertyMarker[] | null,
    timestamp: 0
};
const CACHE_TTL = 5 * 60 * 1000; // 5分間キャッシュ

// Dynamically import map to avoid SSR issues
const MapView = dynamic<MapViewProps>(() => import('./MapView').then(mod => mod.default), {
    ssr: false,
    loading: () => (
        <div className="h-[600px] flex items-center justify-center bg-yellow-50 dark:bg-slate-900 rounded-lg border-3 border-slate-900 dark:border-white">
            <Loader2 className="h-8 w-8 animate-spin text-cyan-500" />
        </div>
    )
});

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

interface InteractiveMapProps {
    filters?: {
        category?: string;
        categoryType?: string;
        priceRange?: [number, number];
    };
    fullPage?: boolean; // フルページモード（マップページ用）
}

// 沖縄本島の地域
const REGIONS = [
    { name: '沖縄本島', cities: [], center: [26.3344, 127.8056] as [number, number], zoom: 10 },
    { name: '那覇・南部', cities: ['那覇市', '浦添市', '豊見城市', '糸満市', '南城市', '八重瀬町', '南風原町', '与那原町', '西原町'], center: [26.2124, 127.6809] as [number, number], zoom: 11 },
    { name: '中部', cities: ['沖縄市', 'うるま市', '宜野湾市', '北谷町', '嘉手納町', '読谷村', '北中城村', '中城村'], center: [26.3344, 127.8056] as [number, number], zoom: 11 },
    { name: '北部', cities: ['名護市', '本部町', '今帰仁村', '恩納村', '金武町', '宜野座村', '大宜味村', '東村', '国頭村'], center: [26.5919, 127.9772] as [number, number], zoom: 10 },
];

// スマホ119 店舗情報（北から南の順）
const SUMAHO119_STORES = [
    { id: 'nago', name: '名護店', subtitle: '', address: '沖縄県名護市見取川原4472 イオン名護店 1F', coordinates: [26.5919, 127.9772] as [number, number], googleMapsUrl: 'https://maps.google.com/?q=26.5919,127.9772' },
    { id: 'ishikawa', name: '石川店', subtitle: '', address: '沖縄県うるま市石川2-24-5', coordinates: [26.4319, 127.8308] as [number, number], googleMapsUrl: 'https://maps.google.com/?q=26.4319,127.8308' },
    { id: 'uruma', name: 'うるま店', subtitle: '', address: '沖縄県うるま市江洲507 うるまシティプラザ1F', coordinates: [26.3719, 127.8508] as [number, number], googleMapsUrl: 'https://maps.google.com/?q=26.3719,127.8508' },
    { id: 'awase', name: '泡瀬店', subtitle: '', address: '沖縄県沖縄市泡瀬4-5-7 イオンタウン泡瀬店', coordinates: [26.3344, 127.8508] as [number, number], googleMapsUrl: 'https://maps.google.com/?q=26.3344,127.8508' },
    { id: 'ginowan', name: '宜野湾店', subtitle: '（本社）', address: '沖縄県宜野湾市上原1-6-3', coordinates: [26.2815, 127.7781] as [number, number], googleMapsUrl: 'https://maps.google.com/?q=26.2815,127.7781' },
    { id: 'nishihara', name: '西原店', subtitle: '', address: '沖縄県中頭郡西原町小波津616-3-1F', coordinates: [26.2181, 127.7614] as [number, number], googleMapsUrl: 'https://maps.google.com/?q=26.2181,127.7614' },
    { id: 'toyomi', name: 'とよみ店', subtitle: '', address: '沖縄県豊見城市根差部710 イオンタウンとよみ1F', coordinates: [26.1614, 127.6672] as [number, number], googleMapsUrl: 'https://maps.google.com/?q=26.1614,127.6672' },
    { id: 'itoman', name: '糸満店', subtitle: '', address: '沖縄県糸満市潮平780-5', coordinates: [26.1247, 127.6647] as [number, number], googleMapsUrl: 'https://maps.google.com/?q=26.1247,127.6647' },
];

// SessionStorageのキー
const MAP_STATE_KEY = 'mapState';

// マップの状態を保存する型
interface MapState {
    selectedRegion: string;
    selectedStores: string[];
    selectedStoreId?: string; // 選択された店舗のID
    selectedPropertyId?: number; // 選択された物件のID
    mapCenter?: [number, number];
    mapZoom?: number;
}

// 同期的に初期状態を取得（useEffectを待たない）
const getInitialState = (): MapState | null => {
    if (typeof window === 'undefined') return null;
    try {
        const saved = sessionStorage.getItem(MAP_STATE_KEY);
        if (saved) return JSON.parse(saved);
    } catch (e) {
        console.error('Failed to parse saved state:', e);
    }
    return null;
};

// 初期状態を一度だけ取得
const initialState = typeof window !== 'undefined' ? getInitialState() : null;

// カテゴリ定義
const CATEGORIES = [
    { id: 'buy_house', label: '売買戸建', type: '売買' },
    { id: 'buy_mansion', label: '売買マンション', type: '売買' },
    { id: 'buy_land', label: '売買土地', type: '売買' },
    { id: 'rent', label: '賃貸', type: '賃貸' },
];

export default function InteractiveMap({ filters, fullPage = false }: InteractiveMapProps) {
    const router = useRouter();
    const [markers, setMarkers] = useState<PropertyMarker[]>([]);
    // グローバルキャッシュがあれば即座に使用
    const [allMarkers, setAllMarkers] = useState<PropertyMarker[]>(() => globalCache.markers || []);
    const [isNavigating, setIsNavigating] = useState(false); // ページ遷移中フラグ
    const [loading, setLoading] = useState(() => !globalCache.markers);
    const [selectedProperty, setSelectedProperty] = useState<PropertyMarker | null>(null);
    const [selectedStore, setSelectedStore] = useState<typeof SUMAHO119_STORES[0] | null>(() => {
        // 初期状態から店舗を復元
        if (initialState?.selectedStoreId) {
            return SUMAHO119_STORES.find(s => s.id === initialState.selectedStoreId) || null;
        }
        return null;
    });
    const [selectedRegion, setSelectedRegion] = useState<string>(() => initialState?.selectedRegion || '');
    const [dataLoaded, setDataLoaded] = useState(() => !!globalCache.markers);
    const [selectedStores, setSelectedStores] = useState<string[]>(() => initialState?.selectedStores || []);
    const [mapCenter, setMapCenter] = useState<[number, number] | undefined>(() => initialState?.mapCenter);
    const [mapZoom, setMapZoom] = useState<number | undefined>(() => initialState?.mapZoom);
    const [pendingPropertyId, setPendingPropertyId] = useState<number | null>(() => initialState?.selectedPropertyId || null);
    const [pendingStoreId, setPendingStoreId] = useState<string | null>(null); // 店舗は上で復元済み
    
    // フィルター用ステート
    const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
    const [showOnlyActive, setShowOnlyActive] = useState(true); // 販売中のみ表示

    // 状態が変更されたときにSessionStorageに保存（debounce: 500ms）
    const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    useEffect(() => {
        if (typeof window !== 'undefined') {
            // 既存のタイマーをクリア
            if (saveTimeoutRef.current) {
                clearTimeout(saveTimeoutRef.current);
            }
            // 500ms後に保存（連続クリック時の負荷軽減）
            saveTimeoutRef.current = setTimeout(() => {
                const state: MapState = {
                    selectedRegion,
                    selectedStores,
                    selectedStoreId: selectedStore?.id,
                    selectedPropertyId: selectedProperty?.id,
                    mapCenter,
                    mapZoom
                };
                sessionStorage.setItem(MAP_STATE_KEY, JSON.stringify(state));
            }, 500);
        }
        return () => {
            if (saveTimeoutRef.current) {
                clearTimeout(saveTimeoutRef.current);
            }
        };
    }, [selectedRegion, selectedStores, selectedStore, selectedProperty, mapCenter, mapZoom]);

    // 初回マウント時に沖縄本島のデータを読み込む
    useEffect(() => {
        fetchMarkers();
    }, []);

    // 離島の市町村リスト
    const REMOTE_ISLANDS = ['宮古島市', '石垣市', '久米島町', '竹富町', '与那国町', '多良間村',
        '伊江村', '伊平屋村', '伊是名村', '渡嘉敷村', '座間味村', '粟国村',
        '渡名喜村', '南大東村', '北大東村'];

    const fetchMarkers = async () => {
        try {
            // グローバルキャッシュを確認（5分以内ならキャッシュを使用）
            const now = Date.now();
            if (globalCache.markers && (now - globalCache.timestamp) < CACHE_TTL) {
                console.log('Using cached markers (instant load)');
                setAllMarkers(globalCache.markers);
                setDataLoaded(true);
                setLoading(false);
                return;
            }

            setLoading(true);
            const response = await fetch('/api/properties/locations?limit=500');
            const data = await response.json();

            if (data.success) {
                // 離島を除外
                const mainlandMarkers = data.markers.filter((m: PropertyMarker) =>
                    !REMOTE_ISLANDS.some(island => m.city.includes(island))
                );

                // グローバルキャッシュに保存
                globalCache.markers = mainlandMarkers;
                globalCache.timestamp = now;

                setAllMarkers(mainlandMarkers);
                setDataLoaded(true);
                console.log(`Loaded ${mainlandMarkers.length} markers (沖縄本島のみ)${data.cached ? ' (cached)' : ''}`);
            } else {
                console.error('Failed to fetch markers:', data.error);
            }
        } catch (error) {
            console.error('Error fetching markers:', error);
        } finally {
            setLoading(false);
        }
    };

    // データ読み込み後に復元された状態を適用
    useEffect(() => {
        if (dataLoaded && allMarkers.length > 0) {
            // 復元された地域に基づいてマーカーをフィルタリング
            if (selectedRegion) {
                if (selectedRegion === '沖縄本島') {
                    setMarkers(allMarkers);
                } else {
                    const region = REGIONS.find(r => r.name === selectedRegion);
                    if (region && region.cities.length > 0) {
                        const filtered = allMarkers.filter(m =>
                            region.cities.some(city => m.city.includes(city))
                        );
                        setMarkers(filtered);
                    }
                }
            }

            // 復元待ちの物件を選択
            if (pendingPropertyId) {
                const property = allMarkers.find(m => m.id === pendingPropertyId);
                if (property) {
                    setSelectedProperty(property);
                    setSelectedStore(null);
                }
                setPendingPropertyId(null);
            }

            // 復元待ちの店舗を選択
            if (pendingStoreId) {
                const store = SUMAHO119_STORES.find(s => s.id === pendingStoreId);
                if (store) {
                    setSelectedStore(store);
                    setSelectedProperty(null);
                }
                setPendingStoreId(null);
            }
        }
    }, [dataLoaded, allMarkers, selectedRegion, pendingPropertyId, pendingStoreId]);

    const handleRegionSelect = (regionName: string) => {
        // 同じ地域が選択されている場合は選択解除（OFF）
        if (selectedRegion === regionName) {
            setSelectedRegion('');
            setSelectedStores([]);
            setMarkers([]); // マーカーを非表示
            setMapCenter([26.3344, 127.8056]); // 沖縄本島の中心にリセット
            setMapZoom(10);
            return;
        }

        // 新しい地域を選択（ON）
        setSelectedRegion(regionName);
        setSelectedStores([]); // 地域変更時は店舗選択をクリア

        // データがまだ読み込まれていない場合は取得
        if (!dataLoaded) {
            fetchMarkers();
        }

        // 地域の中心座標に移動
        const region = REGIONS.find(r => r.name === regionName);
        if (region) {
            setMapCenter(region.center);
            setMapZoom(region.zoom || 11);
        }

        // 地域でフィルタリング
        if (regionName === '沖縄本島' || regionName === '') {
            setMarkers(allMarkers);
        } else {
            if (region && region.cities.length > 0) {
                const filtered = allMarkers.filter(m =>
                    region.cities.some(city => m.city.includes(city))
                );
                setMarkers(filtered);
            }
        }
    };

    const clearRegion = () => {
        setSelectedRegion('');
        setSelectedStores([]);
        setMarkers([]); // マーカーを全て非表示にする
        setMapCenter([26.3344, 127.8056]); // 沖縄本島の中心にリセット
        setMapZoom(10); // デフォルトのズームレベル
    };

    const toggleStore = (storeId: string) => {
        const store = SUMAHO119_STORES.find(s => s.id === storeId);
        const isCurrentlySelected = selectedStores.includes(storeId);

        // 新しい選択状態を計算
        const newSelectedStores = isCurrentlySelected
            ? selectedStores.filter(id => id !== storeId)
            : [...selectedStores, storeId];

        if (isCurrentlySelected) {
            // 選択解除（OFF）
            if (newSelectedStores.length === 0) {
                setSelectedStore(null);
                setMapCenter([26.3344, 127.8056]);
                setMapZoom(10);
            } else {
                // 残りの店舗が全部見えるようにする
                fitBoundsToStores(newSelectedStores);
            }
        } else {
            // 新規選択（ON）
            if (store) {
                setSelectedStore(store);
                setSelectedProperty(null);
                
                if (newSelectedStores.length === 1) {
                    // 1店舗だけの場合はその店舗にズーム
                    setMapCenter(store.coordinates);
                    setMapZoom(14);
                } else {
                    // 複数店舗の場合は全店舗が見えるようにする
                    fitBoundsToStores(newSelectedStores);
                }
            }
        }

        setSelectedStores(newSelectedStores);
    };

    // 選択された店舗が全て見えるようにマップを調整
    const fitBoundsToStores = (storeIds: string[]) => {
        const stores = storeIds.map(id => SUMAHO119_STORES.find(s => s.id === id)).filter(Boolean);
        if (stores.length === 0) return;

        if (stores.length === 1) {
            setMapCenter(stores[0]!.coordinates);
            setMapZoom(14);
        } else {
            // 複数店舗の中心と適切なズームを計算
            const lats = stores.map(s => s!.coordinates[0]);
            const lngs = stores.map(s => s!.coordinates[1]);
            const centerLat = (Math.min(...lats) + Math.max(...lats)) / 2;
            const centerLng = (Math.min(...lngs) + Math.max(...lngs)) / 2;
            
            // 範囲に応じてズームレベルを決定
            const latDiff = Math.max(...lats) - Math.min(...lats);
            const lngDiff = Math.max(...lngs) - Math.min(...lngs);
            const maxDiff = Math.max(latDiff, lngDiff);
            
            let zoom = 10;
            if (maxDiff < 0.05) zoom = 14;
            else if (maxDiff < 0.1) zoom = 13;
            else if (maxDiff < 0.2) zoom = 12;
            else if (maxDiff < 0.5) zoom = 11;
            
            setMapCenter([centerLat, centerLng]);
            setMapZoom(zoom);
        }
    };

    // 全店舗を選択
    const selectAllStores = () => {
        const allStoreIds = SUMAHO119_STORES.map(s => s.id);
        setSelectedStores(allStoreIds);
        // 沖縄全体が見えるようにズームアウト
        setMapCenter([26.3344, 127.8056]);
        setMapZoom(10);
    };

    // 店舗マーカークリック時のハンドラー（メモ化）
    const handleStoreClick = useCallback((storeName: string) => {
        const store = SUMAHO119_STORES.find(s => s.name === storeName);
        if (store) {
            setSelectedStore(store);
            setSelectedProperty(null);
        }
    }, []);

    // 物件マーカークリック時のハンドラー（メモ化）+ プリフェッチ
    const handlePropertyClick = useCallback((marker: PropertyMarker) => {
        setSelectedProperty(marker);
        setSelectedStore(null);
        
        // 詳細ページとデータをプリフェッチ（先読み）
        if (marker.url) {
            const encodedUrl = encodeURIComponent(marker.url);
            const detailPath = `/properties/${encodedUrl}`;
            
            // 1. ルートのプリフェッチ
            router.prefetch(detailPath);
            
            // 2. 物件詳細APIをプリフェッチ（バックグラウンドで先読み）
            fetch(`/api/properties/${encodedUrl}`, {
                method: 'GET',
                // キャッシュを有効にして次回アクセス時に即座に使用
                cache: 'force-cache'
            }).catch(() => {}); // エラーは無視（プリフェッチなので）
            
            // 3. AIコピー履歴もプリフェッチ
            fetch('/api/ai/history', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: marker.url }),
                cache: 'force-cache'
            }).catch(() => {});
        }
    }, [router]);

    // フィルタリング結果をメモ化（不要な再計算を防止）
    const filteredMarkers = useMemo(() => {
        return markers.filter(marker => {
            // 外部フィルター（propsから）
            if (filters?.category && marker.category !== filters.category) return false;
            if (filters?.categoryType && marker.categoryType !== filters.categoryType) return false;
            
            // 内部カテゴリフィルター
            if (selectedCategories.length > 0) {
                const matchesCategory = selectedCategories.some(catId => {
                    const cat = CATEGORIES.find(c => c.id === catId);
                    if (!cat) return false;
                    // カテゴリタイプ（売買/賃貸）でマッチング
                    if (cat.type === '賃貸') {
                        return marker.categoryType === '賃貸';
                    } else {
                        // 売買の場合、genreNameで細かくフィルタ
                        if (catId === 'buy_house') return marker.genreName?.includes('戸建');
                        if (catId === 'buy_mansion') return marker.genreName?.includes('マンション');
                        if (catId === 'buy_land') return marker.genreName?.includes('土地');
                    }
                    return false;
                });
                if (!matchesCategory) return false;
            }
            
            return true;
        });
    }, [markers, filters?.category, filters?.categoryType, selectedCategories]);
    
    // カテゴリトグル
    const toggleCategory = (catId: string) => {
        setSelectedCategories(prev => 
            prev.includes(catId) 
                ? prev.filter(id => id !== catId)
                : [...prev, catId]
        );
    };

    // MapViewに渡す店舗リストをメモ化
    const selectedStoreLocations = useMemo(() => {
        return SUMAHO119_STORES.filter(store => selectedStores.includes(store.id));
    }, [selectedStores]);

    const containerHeight = fullPage ? 'h-[calc(100vh-100px)]' : 'h-[500px]';

    return (
        <div className={`flex gap-2 ${containerHeight}`}>
            {/* Left Sidebar - Controls */}
            <div className="w-36 flex-shrink-0 flex flex-col gap-2 h-full">
                {/* カテゴリフィルター - 常時表示 */}
                <div className="p-2 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg border border-indigo-200 dark:border-indigo-700 flex-shrink-0">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-indigo-700 dark:text-indigo-400">🏷️ カテゴリ</span>
                        {selectedCategories.length > 0 && (
                            <button onClick={() => setSelectedCategories([])} className="text-xs text-rose-500 hover:text-rose-600">✕</button>
                        )}
                    </div>
                    <div className="grid grid-cols-2 gap-1">
                        {CATEGORIES.map((cat) => (
                            <button
                                key={cat.id}
                                onClick={() => toggleCategory(cat.id)}
                                className={`text-[10px] px-1.5 py-1 rounded border transition-colors ${
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
                            <span className="text-[10px] text-slate-600 dark:text-slate-400">販売中のみ</span>
                        </label>
                    </div>
                    <div className="mt-1 text-center">
                        <span className="text-[10px] text-indigo-500">{filteredMarkers.length}件表示</span>
                    </div>
                </div>

                {/* Region Selection - 固定高さ */}
                <div className="p-2 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 flex-shrink-0 overflow-hidden">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-slate-700 dark:text-slate-300">📍 地域</span>
                        <button onClick={clearRegion} className="text-xs text-rose-500 hover:text-rose-600">✕</button>
                    </div>
                    <div className="flex flex-col gap-1 overflow-hidden">
                        {REGIONS.map((region) => (
                            <Button
                                key={region.name}
                                onClick={() => handleRegionSelect(region.name)}
                                variant={selectedRegion === region.name ? "default" : "outline"}
                                size="sm"
                                className={`h-6 w-full text-xs justify-start px-2 transform-none hover:scale-100 ${selectedRegion === region.name ?
                                    "bg-cyan-500 hover:bg-cyan-600" :
                                    "border-slate-300 dark:border-slate-600"
                                }`}
                            >
                                {region.name}
                            </Button>
                        ))}
                    </div>
                </div>

                {/* Store Selection - スクロール可能 */}
                <div className="p-2 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-700 flex-1 flex flex-col min-h-0 overflow-hidden">
                    <div className="flex items-center justify-between mb-2 flex-shrink-0">
                        <span className="text-xs font-bold text-amber-700 dark:text-amber-400">📱 店舗 ({SUMAHO119_STORES.length})</span>
                        <button onClick={selectAllStores} className="text-xs text-amber-600 hover:text-amber-700">全</button>
                    </div>
                    <div className="flex flex-col gap-1 overflow-y-auto overflow-x-hidden flex-1 pr-1">
                        {SUMAHO119_STORES.map((store) => (
                            <Button
                                key={store.id}
                                onClick={() => toggleStore(store.id)}
                                variant={selectedStores.includes(store.id) ? "default" : "outline"}
                                size="sm"
                                className={`h-6 w-full text-xs justify-start px-2 flex-shrink-0 transform-none hover:scale-100 ${selectedStores.includes(store.id) ?
                                    "bg-amber-500 hover:bg-amber-600" :
                                    "border-amber-300 dark:border-amber-600 text-amber-600 dark:text-amber-400"
                                }`}
                            >
                                {store.name}
                            </Button>
                        ))}
                    </div>
                    {selectedStores.length > 0 && (
                        <button 
                            onClick={() => { setSelectedStores([]); setSelectedStore(null); }} 
                            className="w-full mt-2 text-xs text-rose-500 hover:text-rose-600 flex-shrink-0 border-t border-amber-200 pt-2"
                        >
                            ✕ クリア ({selectedStores.length}件)
                        </button>
                    )}
                </div>
            </div>

            {/* Map Area */}
            <div className="flex-1 h-full">
                {loading ? (
                    <div className="h-full flex items-center justify-center bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
                        <div className="text-center">
                            <Loader2 className="h-8 w-8 animate-spin text-cyan-500 mx-auto mb-2" />
                            <p className="text-sm text-slate-600 dark:text-slate-400">読み込み中...</p>
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
                        <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-2 line-clamp-2">{selectedProperty.title}</h3>
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
                                <span className="font-semibold text-slate-900 dark:text-white text-xs">{selectedProperty.genreName}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-slate-500 text-xs">価格</span>
                                <span className="font-bold text-cyan-600 text-xs">{selectedProperty.price}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-slate-500 text-xs">タイプ</span>
                                <span className="font-semibold text-slate-900 dark:text-white text-xs">{selectedProperty.categoryType}</span>
                            </div>
                            <div className="pt-1.5 border-t border-slate-200 dark:border-slate-600">
                                <span className="text-slate-500 text-xs">所在地</span>
                                <p className="text-slate-900 dark:text-white font-medium text-xs mt-0.5">{selectedProperty.location}</p>
                            </div>
                        </div>
                        
                        {/* 詳細ページへのリンクボタン（hover時にプリフェッチ開始） */}
                        <button
                            onClick={() => {
                                // 即座にローディング表示
                                setIsNavigating(true);
                                // 遷移開始
                                router.push(`/properties/${encodeURIComponent(selectedProperty.url)}`);
                            }}
                            onMouseEnter={() => {
                                // マウスオーバー時にプリフェッチ開始
                                const path = `/properties/${encodeURIComponent(selectedProperty.url)}`;
                                router.prefetch(path);
                                // APIデータも先読み
                                fetch(`/api/properties/${encodeURIComponent(selectedProperty.url)}`, { cache: 'force-cache' });
                            }}
                            onTouchStart={() => {
                                // タッチデバイス対応
                                const path = `/properties/${encodeURIComponent(selectedProperty.url)}`;
                                router.prefetch(path);
                            }}
                            disabled={isNavigating}
                            className={`mt-3 w-full flex items-center justify-center gap-2 text-white font-bold py-2 px-3 rounded-lg transition-colors text-sm cursor-pointer ${
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
                        {/* ミニマップ */}
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

                        {/* 店舗名 */}
                        <div className="text-center mb-3">
                            <h3 className="text-base font-bold text-amber-700 dark:text-amber-400">
                                📱 スマホ119 {selectedStore.name}{selectedStore.subtitle}
                            </h3>
                        </div>

                        {/* 店舗情報 */}
                        <div className="space-y-2 text-sm">
                            <div className="bg-white dark:bg-slate-800 rounded p-2">
                                <span className="text-amber-600 text-xs font-bold">📍 住所</span>
                                <p className="text-slate-900 dark:text-white mt-1 text-xs">{selectedStore.address}</p>
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

                        {/* Googleマップリンク */}
                        <a
                            href={selectedStore.googleMapsUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-3 w-full flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-600 text-white font-bold py-2 px-4 rounded-lg transition-colors"
                        >
                            🗺️ Googleマップで見る
                        </a>
                    </div>
                ) : (
                    <div className="h-full flex items-center justify-center bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
                        <div className="text-center p-4">
                            <MapPin className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                            <p className="text-slate-500 text-sm font-medium">マーカーを選択</p>
                            <p className="text-slate-400 text-xs mt-1">詳細情報が表示されます</p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
