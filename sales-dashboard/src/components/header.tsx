"use client";

import { Bell, Search, Home, Building2, Store, Car, ParkingCircle, MapPin, Building, Package, CircleDollarSign, X, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { usePathname } from "next/navigation";
import { useState, useEffect, useCallback } from "react";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";

// カテゴリ定義（8カテゴリ）
const CATEGORIES = {
    rent: [
        { id: 'jukyo', label: '住居', icon: Home, color: 'bg-blue-500 hover:bg-blue-600' },
        { id: 'jigyou', label: '事業用', icon: Store, color: 'bg-purple-500 hover:bg-purple-600' },
        { id: 'yard', label: '月極駐車場', icon: Car, color: 'bg-green-500 hover:bg-green-600' },
        { id: 'parking', label: '時間貸', icon: ParkingCircle, color: 'bg-teal-500 hover:bg-teal-600' },
    ],
    buy: [
        { id: 'tochi', label: '土地', icon: MapPin, color: 'bg-orange-500 hover:bg-orange-600' },
        { id: 'mansion', label: 'マンション', icon: Building, color: 'bg-rose-500 hover:bg-rose-600' },
        { id: 'house', label: '戸建', icon: Home, color: 'bg-amber-500 hover:bg-amber-600' },
        { id: 'sonota', label: 'その他', icon: Package, color: 'bg-slate-500 hover:bg-slate-600' },
    ],
};

// 金額クイック選択
const PRICE_PRESETS = {
    rent: [
        { label: '〜3万', max: 30000 },
        { label: '〜5万', max: 50000 },
        { label: '〜8万', max: 80000 },
        { label: '〜10万', max: 100000 },
        { label: '10万〜', min: 100000 },
    ],
    buy: [
        { label: '〜1000万', max: 10000000 },
        { label: '〜2000万', max: 20000000 },
        { label: '〜3000万', max: 30000000 },
        { label: '〜5000万', max: 50000000 },
        { label: '5000万〜', min: 50000000 },
    ],
};

// フィルター状態をグローバルに公開するための型
export interface FilterState {
    categories: string[];
    type: 'all' | 'rent' | 'buy';
    priceMin: number | null;
    priceMax: number | null;
    searchTerm: string;
}

// グローバルフィルター状態（シンプルな実装）
let globalFilterState: FilterState = {
    categories: [],
    type: 'all',
    priceMin: null,
    priceMax: null,
    searchTerm: '',
};
let filterListeners: ((state: FilterState) => void)[] = [];

export function getFilterState(): FilterState {
    return globalFilterState;
}

export function subscribeToFilter(callback: (state: FilterState) => void): () => void {
    filterListeners.push(callback);
    return () => {
        filterListeners = filterListeners.filter(cb => cb !== callback);
    };
}

function notifyFilterChange(state: FilterState) {
    globalFilterState = state;
    filterListeners.forEach(cb => cb(state));
}

export function Header() {
    const pathname = usePathname();
    
    // フィルター状態
    const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
    const [selectedType, setSelectedType] = useState<'all' | 'rent' | 'buy'>('all');
    const [priceMin, setPriceMin] = useState<number | null>(null);
    const [priceMax, setPriceMax] = useState<number | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [priceOpen, setPriceOpen] = useState(false);

    // フィルター変更を通知
    useEffect(() => {
        notifyFilterChange({
            categories: selectedCategories,
            type: selectedType,
            priceMin,
            priceMax,
            searchTerm,
        });
    }, [selectedCategories, selectedType, priceMin, priceMax, searchTerm]);

    if (pathname === "/login") return null;

    // カテゴリトグル
    const toggleCategory = (id: string) => {
        setSelectedCategories(prev => 
            prev.includes(id) 
                ? prev.filter(c => c !== id)
                : [...prev, id]
        );
        setSelectedType('all');
    };

    // 全カテゴリID
    const allCategoryIds = [...CATEGORIES.rent.map(c => c.id), ...CATEGORIES.buy.map(c => c.id)];
    const rentCategoryIds = CATEGORIES.rent.map(c => c.id);
    const buyCategoryIds = CATEGORIES.buy.map(c => c.id);

    // タイプ選択（トグル動作）
    const selectType = (type: 'all' | 'rent' | 'buy') => {
        if (type === 'all') {
            // 全カテゴリが選択されていれば解除、そうでなければ全選択
            const allSelected = allCategoryIds.every(id => selectedCategories.includes(id));
            if (allSelected) {
                setSelectedCategories([]);
                setSelectedType('all');
            } else {
                setSelectedCategories(allCategoryIds);
                setSelectedType('all');
            }
        } else if (type === 'rent') {
            // 賃貸全体が選択されていれば解除、そうでなければ賃貸全選択
            const rentSelected = rentCategoryIds.every(id => selectedCategories.includes(id));
            if (rentSelected && selectedType === 'rent') {
                setSelectedCategories(prev => prev.filter(id => !rentCategoryIds.includes(id)));
                setSelectedType('all');
            } else {
                setSelectedCategories(rentCategoryIds);
                setSelectedType('rent');
            }
        } else {
            // 売買全体が選択されていれば解除、そうでなければ売買全選択
            const buySelected = buyCategoryIds.every(id => selectedCategories.includes(id));
            if (buySelected && selectedType === 'buy') {
                setSelectedCategories(prev => prev.filter(id => !buyCategoryIds.includes(id)));
                setSelectedType('all');
            } else {
                setSelectedCategories(buyCategoryIds);
                setSelectedType('buy');
            }
        }
    };

    // 金額プリセット選択
    const selectPricePreset = (preset: { min?: number; max?: number }) => {
        setPriceMin(preset.min || null);
        setPriceMax(preset.max || null);
        setPriceOpen(false);
    };

    // フィルタークリア
    const clearFilters = () => {
        setSelectedCategories([]);
        setSelectedType('all');
        setPriceMin(null);
        setPriceMax(null);
        setSearchTerm('');
    };

    const hasActiveFilters = selectedCategories.length > 0 || priceMin !== null || priceMax !== null || searchTerm;
    const currentPricePresets = selectedType === 'buy' || selectedCategories.some(c => CATEGORIES.buy.map(b => b.id).includes(c)) 
        ? PRICE_PRESETS.buy 
        : PRICE_PRESETS.rent;

    // 金額表示テキスト
    const priceText = () => {
        if (priceMin && priceMax) return `${formatPrice(priceMin)}〜${formatPrice(priceMax)}`;
        if (priceMin) return `${formatPrice(priceMin)}〜`;
        if (priceMax) return `〜${formatPrice(priceMax)}`;
        return '金額';
    };

    function formatPrice(value: number): string {
        if (value >= 100000000) return `${(value / 100000000).toFixed(1)}億`;
        if (value >= 10000) return `${Math.round(value / 10000)}万`;
        return `${value}円`;
    }

    return (
        <header className="fixed top-0 right-0 left-0 md:left-64 bg-slate-900/95 backdrop-blur-md border-b border-slate-800 z-40 shadow-sm">
            {/* 上段: 検索バー */}
            <div className="h-14 px-4 flex items-center justify-between border-b border-slate-800/50">
                <div className="flex items-center flex-1 max-w-xl">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                        <Input
                            placeholder="物件名、エリアで検索..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-9 bg-slate-800 border-slate-700 text-white h-9 w-full focus:ring-emerald-500 focus:border-emerald-500"
                        />
                    </div>
                </div>

                <div className="flex items-center space-x-3 ml-4">
                    {hasActiveFilters && (
                        <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={clearFilters}
                            className="text-rose-400 hover:text-rose-300 hover:bg-rose-900/20 h-8 px-2"
                        >
                            <X className="h-4 w-4 mr-1" />
                            クリア
                        </Button>
                    )}
                    <Button variant="ghost" size="icon" className="text-slate-400 hover:text-white hover:bg-slate-800 h-8 w-8">
                        <Bell className="h-4 w-4" />
                    </Button>
                    <div className="h-8 w-8 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center text-white font-bold text-sm shadow-lg border border-emerald-400/20 cursor-pointer hover:opacity-90 transition-opacity">
                        A
                    </div>
                </div>
            </div>

            {/* 下段: カテゴリ＆金額フィルター */}
            <div className="h-12 px-4 flex items-center gap-2 overflow-x-auto scrollbar-hide">
                {/* 全体選択ボタン */}
                <div className="flex gap-1 pr-2 border-r border-slate-700 flex-shrink-0">
                    <Button
                        variant={allCategoryIds.every(id => selectedCategories.includes(id)) ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => selectType('all')}
                        className={`h-7 px-2 text-xs ${
                            allCategoryIds.every(id => selectedCategories.includes(id))
                                ? 'bg-emerald-600 text-white'
                                : 'bg-slate-800/50 border-slate-700 text-slate-400 hover:bg-slate-700'
                        }`}
                    >
                        全て
                    </Button>
                    <Button
                        variant={rentCategoryIds.every(id => selectedCategories.includes(id)) ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => selectType('rent')}
                        className={`h-7 px-2 text-xs ${
                            rentCategoryIds.every(id => selectedCategories.includes(id))
                                ? 'bg-blue-600 text-white'
                                : 'bg-slate-800/50 border-blue-800/50 text-blue-400 hover:bg-blue-900/30'
                        }`}
                    >
                        <Building2 className="h-3 w-3 mr-1" />
                        賃貸全体
                    </Button>
                    <Button
                        variant={buyCategoryIds.every(id => selectedCategories.includes(id)) ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => selectType('buy')}
                        className={`h-7 px-2 text-xs ${
                            buyCategoryIds.every(id => selectedCategories.includes(id))
                                ? 'bg-orange-600 text-white'
                                : 'bg-slate-800/50 border-orange-800/50 text-orange-400 hover:bg-orange-900/30'
                        }`}
                    >
                        <Home className="h-3 w-3 mr-1" />
                        売買全体
                    </Button>
                </div>

                {/* 賃貸カテゴリ */}
                <div className="flex gap-1 pr-2 border-r border-slate-700 flex-shrink-0">
                    <span className="text-[10px] text-blue-400 font-semibold self-center px-1">賃貸</span>
                    {CATEGORIES.rent.map((cat) => {
                        const Icon = cat.icon;
                        const isSelected = selectedCategories.includes(cat.id);
                        return (
                            <Button
                                key={cat.id}
                                variant="outline"
                                size="sm"
                                onClick={() => toggleCategory(cat.id)}
                                className={`h-7 px-2 text-xs transition-all ${
                                    isSelected
                                        ? `${cat.color} text-white border-transparent shadow-lg`
                                        : 'bg-slate-800/50 border-slate-700 text-slate-400 hover:bg-slate-700'
                                }`}
                            >
                                <Icon className="h-3 w-3 mr-1" />
                                {cat.label}
                            </Button>
                        );
                    })}
                </div>

                {/* 売買カテゴリ */}
                <div className="flex gap-1 pr-2 border-r border-slate-700 flex-shrink-0">
                    <span className="text-[10px] text-orange-400 font-semibold self-center px-1">売買</span>
                    {CATEGORIES.buy.map((cat) => {
                        const Icon = cat.icon;
                        const isSelected = selectedCategories.includes(cat.id);
                        return (
                            <Button
                                key={cat.id}
                                variant="outline"
                                size="sm"
                                onClick={() => toggleCategory(cat.id)}
                                className={`h-7 px-2 text-xs transition-all ${
                                    isSelected
                                        ? `${cat.color} text-white border-transparent shadow-lg`
                                        : 'bg-slate-800/50 border-slate-700 text-slate-400 hover:bg-slate-700'
                                }`}
                            >
                                <Icon className="h-3 w-3 mr-1" />
                                {cat.label}
                            </Button>
                        );
                    })}
                </div>

                {/* 金額フィルター */}
                <Popover open={priceOpen} onOpenChange={setPriceOpen}>
                    <PopoverTrigger asChild>
                        <Button
                            variant="outline"
                            size="sm"
                            className={`h-7 px-3 text-xs flex-shrink-0 ${
                                priceMin || priceMax
                                    ? 'bg-emerald-600 text-white border-emerald-500'
                                    : 'bg-slate-800/50 border-slate-700 text-slate-400 hover:bg-slate-700'
                            }`}
                        >
                            <CircleDollarSign className="h-3 w-3 mr-1" />
                            {priceText()}
                            <ChevronDown className="h-3 w-3 ml-1" />
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-56 p-3 bg-slate-900 border-slate-700" align="start">
                        <div className="space-y-3">
                            <p className="text-xs font-semibold text-emerald-400">クイック選択</p>
                            <div className="grid grid-cols-2 gap-1">
                                {currentPricePresets.map((preset) => (
                                    <Button
                                        key={preset.label}
                                        variant="outline"
                                        size="sm"
                                        onClick={() => selectPricePreset(preset)}
                                        className={`h-7 text-xs ${
                                            (priceMin === (preset.min || null) && priceMax === (preset.max || null))
                                                ? 'bg-emerald-600 text-white border-emerald-500'
                                                : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
                                        }`}
                                    >
                                        {preset.label}
                                    </Button>
                                ))}
                            </div>
                            {(priceMin || priceMax) && (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => { setPriceMin(null); setPriceMax(null); setPriceOpen(false); }}
                                    className="w-full h-7 text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-900/20"
                                >
                                    <X className="h-3 w-3 mr-1" />
                                    金額フィルターを解除
                                </Button>
                            )}
                        </div>
                    </PopoverContent>
                </Popover>
            </div>
        </header>
    );
}
