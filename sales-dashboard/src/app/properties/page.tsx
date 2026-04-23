"use client";

import { useState, useEffect, useMemo } from 'react';
import { useApi } from '@/lib/use-api';
import { ErrorBanner } from '@/components/ui/error-banner';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, ExternalLink, Sparkles, Home, Building2, Store, Car, ParkingCircle, MapPin, Building, Package, CircleDollarSign, X, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { Input } from "@/components/ui/input";
import Link from 'next/link';

// カテゴリ定義
const CATEGORIES = {
    rent: [
        { id: 'jukyo', label: '住居', icon: Home, color: 'from-blue-500 to-blue-600' },
        { id: 'jigyou', label: '事業用', icon: Store, color: 'from-purple-500 to-purple-600' },
        { id: 'yard', label: '月極駐車場', icon: Car, color: 'from-green-500 to-green-600' },
        { id: 'parking', label: '時間貸駐車場', icon: ParkingCircle, color: 'from-teal-500 to-teal-600' },
    ],
    buy: [
        { id: 'tochi', label: '土地', icon: MapPin, color: 'from-orange-500 to-orange-600' },
        { id: 'mansion', label: 'マンション', icon: Building, color: 'from-rose-500 to-rose-600' },
        { id: 'house', label: '戸建', icon: Home, color: 'from-amber-500 to-amber-600' },
        { id: 'sonota', label: 'その他', icon: Package, color: 'from-slate-500 to-slate-600' },
    ],
};

// 金額のパース（様々な形式に対応）
function parsePrice(priceStr: string | null | undefined): number | null {
    if (!priceStr) return null;
    
    // 「お問い合わせ」「相談」などは除外
    if (priceStr.includes('問') || priceStr.includes('相談') || priceStr.includes('応相談')) {
        return null;
    }
    
    // 数値を抽出
    const numStr = priceStr.replace(/[,，]/g, '').replace(/[０-９]/g, (s) => String.fromCharCode(s.charCodeAt(0) - 0xFEE0));
    
    // 万円形式
    const manMatch = numStr.match(/(\d+(?:\.\d+)?)\s*万/);
    if (manMatch) {
        return parseFloat(manMatch[1]) * 10000;
    }
    
    // 億円形式
    const okuMatch = numStr.match(/(\d+(?:\.\d+)?)\s*億/);
    if (okuMatch) {
        let total = parseFloat(okuMatch[1]) * 100000000;
        const remainingMan = numStr.match(/億\s*(\d+(?:\.\d+)?)\s*万/);
        if (remainingMan) {
            total += parseFloat(remainingMan[1]) * 10000;
        }
        return total;
    }
    
    // 円のみ
    const yenMatch = numStr.match(/(\d+)\s*円/);
    if (yenMatch) {
        return parseInt(yenMatch[1]);
    }
    
    // 数値のみ（大きい数値は円として扱う）
    const numOnly = numStr.match(/(\d+)/);
    if (numOnly) {
        const num = parseInt(numOnly[1]);
        if (num > 100000) return num; // 10万以上は円
        return num * 10000; // それ未満は万円
    }
    
    return null;
}

// 金額フォーマット
function formatPrice(value: number): string {
    if (value >= 100000000) {
        return `${(value / 100000000).toFixed(1)}億`;
    }
    if (value >= 10000) {
        return `${Math.round(value / 10000)}万`;
    }
    return `${value}円`;
}

// 1ページあたりの表示件数オプション
const PAGE_SIZE_OPTIONS = [50, 100, 200, 500];

export default function PropertiesPage() {
    const { data: fetchedProperties, error: fetchError, loading, refetch } = useApi<any[]>(
        '/api/properties?limit=50000',
    );
    const properties = fetchedProperties ?? [];
    const [searchTerm, setSearchTerm] = useState("");
    
    // フィルター状態
    const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
    const [selectedType, setSelectedType] = useState<'all' | 'rent' | 'buy'>('all');
    const [priceRange, setPriceRange] = useState<[number, number]>([0, 500000000]); // 0円〜5億円
    const [priceFilterEnabled, setPriceFilterEnabled] = useState(false);
    const [showFilters, setShowFilters] = useState(true);
    
    // ページネーション状態
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(100);

    // データ取得は useApi に集約。AbortController + error handling 付き。

    // カテゴリを全て取得
    const allCategoryIds = useMemo(() => 
        [...CATEGORIES.rent, ...CATEGORIES.buy].map(c => c.id), 
        []
    );
    
    // カテゴリトグル
    const toggleCategory = (id: string) => {
        setSelectedCategories(prev => 
            prev.includes(id) 
                ? prev.filter(c => c !== id)
                : [...prev, id]
        );
        setSelectedType('all');
        setCurrentPage(1); // フィルター変更時にページをリセット
    };
    
    // タイプ選択
    const selectType = (type: 'all' | 'rent' | 'buy') => {
        setSelectedType(type);
        if (type === 'all') {
            setSelectedCategories([]);
        } else if (type === 'rent') {
            setSelectedCategories(CATEGORIES.rent.map(c => c.id));
        } else {
            setSelectedCategories(CATEGORIES.buy.map(c => c.id));
        }
        setCurrentPage(1); // フィルター変更時にページをリセット
    };
    
    // 全てクリア
    const clearFilters = () => {
        setSelectedCategories([]);
        setSelectedType('all');
        setPriceFilterEnabled(false);
        setPriceRange([0, 500000000]);
        setSearchTerm('');
        setCurrentPage(1);
    };

    // フィルタリング
    const filteredProperties = useMemo(() => {
        return properties.filter(p => {
            // テキスト検索（検索対象を限定）
            const searchLower = searchTerm.toLowerCase();
            let matchesSearch = !searchTerm;
            
            if (searchTerm) {
                // タイトル
                if (p.title?.toLowerCase().includes(searchLower)) {
                    matchesSearch = true;
                }
                // 会社名
                else if (p.company_name?.toLowerCase().includes(searchLower)) {
                    matchesSearch = true;
                }
                // カテゴリ名
                else if (p.category_name_ja?.toLowerCase().includes(searchLower)) {
                    matchesSearch = true;
                }
                // ジャンル名
                else if (p.genre_name_ja?.toLowerCase().includes(searchLower)) {
                    matchesSearch = true;
                }
                // 所在地（property_dataから抽出）
                else if (p.property_data) {
                    const location = p.property_data['所在地'] || p.property_data['住所'] || p.property_data['物件所在地'] || '';
                    if (location.toLowerCase().includes(searchLower)) {
                        matchesSearch = true;
                    }
                }
            }
            
            if (!matchesSearch) return false;
            
            // カテゴリフィルター
            if (selectedCategories.length > 0) {
                // DBのカテゴリ名をマッピング（様々な形式に対応）
                const category = p.category?.toLowerCase() || '';
                const genre = p.genre_name_ja || '';
                const categoryType = p.category_type || '';
                
                // カテゴリのマッチング
                let matchesCategory = false;
                
                for (const catId of selectedCategories) {
                    if (category === catId || category.includes(catId)) {
                        matchesCategory = true;
                        break;
                    }
                    // ジャンル名でのマッチング
                    if (catId === 'jukyo' && (genre.includes('住居') || genre.includes('アパート') || genre.includes('マンション') && categoryType === '賃貸')) {
                        matchesCategory = true;
                        break;
                    }
                    if (catId === 'jigyou' && (genre.includes('事業') || genre.includes('店舗') || genre.includes('倉庫'))) {
                        matchesCategory = true;
                        break;
                    }
                    if (catId === 'yard' && genre.includes('月極')) {
                        matchesCategory = true;
                        break;
                    }
                    if (catId === 'parking' && (genre.includes('時間貸') || genre.includes('コイン'))) {
                        matchesCategory = true;
                        break;
                    }
                    if (catId === 'tochi' && genre.includes('土地')) {
                        matchesCategory = true;
                        break;
                    }
                    if (catId === 'mansion' && genre.includes('マンション') && categoryType === '売買') {
                        matchesCategory = true;
                        break;
                    }
                    if (catId === 'house' && (genre.includes('戸建') || genre.includes('一戸建'))) {
                        matchesCategory = true;
                        break;
                    }
                    if (catId === 'sonota' && genre.includes('その他')) {
                        matchesCategory = true;
                        break;
                    }
                }
                
                if (!matchesCategory) return false;
            }
            
            // 金額フィルター
            if (priceFilterEnabled) {
                const price = parsePrice(p.price);
                if (price !== null) {
                    if (price < priceRange[0] || price > priceRange[1]) {
                        return false;
                    }
                }
            }
            
            return true;
        });
    }, [properties, searchTerm, selectedCategories, priceFilterEnabled, priceRange]);
    
    // ページネーション計算
    const totalPages = Math.ceil(filteredProperties.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const currentProperties = filteredProperties.slice(startIndex, endIndex);
    
    // ページ変更時のスクロール
    const handlePageChange = (page: number) => {
        setCurrentPage(page);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };
    
    // 統計
    const stats = useMemo(() => {
        const total = filteredProperties.length;
        const active = filteredProperties.filter(p => p.is_active).length;
        return { total, active };
    }, [filteredProperties]);
    
    // フィルター変更時にページをリセット
    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, priceFilterEnabled, priceRange]);

    // ページ番号の配列を生成
    const getPageNumbers = () => {
        const pages: (number | string)[] = [];
        const maxVisiblePages = 7;
        
        if (totalPages <= maxVisiblePages) {
            for (let i = 1; i <= totalPages; i++) {
                pages.push(i);
            }
        } else {
            if (currentPage <= 4) {
                for (let i = 1; i <= 5; i++) pages.push(i);
                pages.push('...');
                pages.push(totalPages);
            } else if (currentPage >= totalPages - 3) {
                pages.push(1);
                pages.push('...');
                for (let i = totalPages - 4; i <= totalPages; i++) pages.push(i);
            } else {
                pages.push(1);
                pages.push('...');
                for (let i = currentPage - 1; i <= currentPage + 1; i++) pages.push(i);
                pages.push('...');
                pages.push(totalPages);
            }
        }
        return pages;
    };

    return (
        <div className="flex-1 space-y-4 p-8 pt-6 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 min-h-screen text-slate-100">
            {fetchError && <ErrorBanner message={fetchError} onRetry={refetch} />}
            {/* ヘッダー */}
            <div className="flex items-center justify-between">
                <div>
                <h2 className="text-3xl font-bold tracking-tight text-white">物件一覧</h2>
                    <p className="text-slate-400 mt-1">
                        全 {properties.length.toLocaleString()} 件中 {stats.total.toLocaleString()} 件ヒット
                        {selectedCategories.length > 0 && ` (${selectedCategories.length}カテゴリ選択)`}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowFilters(!showFilters)}
                        className="bg-slate-800/50 border-slate-700 text-slate-300 hover:bg-slate-700"
                    >
                        {showFilters ? <ChevronUp className="h-4 w-4 mr-1" /> : <ChevronDown className="h-4 w-4 mr-1" />}
                        フィルター
                    </Button>
                    {(selectedCategories.length > 0 || priceFilterEnabled || searchTerm) && (
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={clearFilters}
                            className="bg-red-900/30 border-red-800 text-red-300 hover:bg-red-800/50"
                        >
                            <X className="h-4 w-4 mr-1" /> クリア
                        </Button>
                    )}
                </div>
            </div>

            {/* フィルターパネル */}
            {showFilters && (
                <Card className="bg-slate-900/80 border-slate-800 backdrop-blur-sm">
                    <CardContent className="p-4 space-y-4">
                        {/* 賃貸/売買 全体選択 */}
                        <div className="flex flex-wrap gap-2 pb-3 border-b border-slate-800">
                            <Button
                                variant={selectedType === 'all' ? 'default' : 'outline'}
                                size="sm"
                                onClick={() => selectType('all')}
                                className={selectedType === 'all' 
                                    ? 'bg-gradient-to-r from-slate-600 to-slate-700 text-white shadow-lg' 
                                    : 'bg-slate-800/50 border-slate-700 text-slate-300 hover:bg-slate-700'}
                            >
                                全て
                            </Button>
                            <Button
                                variant={selectedType === 'rent' ? 'default' : 'outline'}
                                size="sm"
                                onClick={() => selectType('rent')}
                                className={selectedType === 'rent' 
                                    ? 'bg-gradient-to-r from-blue-600 to-cyan-600 text-white shadow-lg shadow-blue-500/30' 
                                    : 'bg-slate-800/50 border-blue-800/50 text-blue-300 hover:bg-blue-900/30'}
                            >
                                <Building2 className="h-4 w-4 mr-1" /> 賃貸全体
                            </Button>
                            <Button
                                variant={selectedType === 'buy' ? 'default' : 'outline'}
                                size="sm"
                                onClick={() => selectType('buy')}
                                className={selectedType === 'buy' 
                                    ? 'bg-gradient-to-r from-orange-600 to-amber-600 text-white shadow-lg shadow-orange-500/30' 
                                    : 'bg-slate-800/50 border-orange-800/50 text-orange-300 hover:bg-orange-900/30'}
                            >
                                <Home className="h-4 w-4 mr-1" /> 売買全体
                            </Button>
                        </div>

                        {/* カテゴリ選択 - 賃貸 */}
                        <div>
                            <p className="text-xs font-semibold text-blue-400 mb-2">🏢 賃貸カテゴリ</p>
                            <div className="flex flex-wrap gap-2">
                                {CATEGORIES.rent.map((cat) => {
                                    const Icon = cat.icon;
                                    const isSelected = selectedCategories.includes(cat.id);
                                    return (
                                        <Button
                                            key={cat.id}
                                            variant="outline"
                                            size="sm"
                                            onClick={() => toggleCategory(cat.id)}
                                            className={isSelected 
                                                ? `bg-gradient-to-r ${cat.color} text-white border-transparent shadow-lg transition-all duration-200 scale-105`
                                                : 'bg-slate-800/50 border-slate-700 text-slate-300 hover:bg-slate-700 hover:scale-102 transition-all duration-200'}
                                        >
                                            <Icon className="h-4 w-4 mr-1" />
                                            {cat.label}
                                        </Button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* カテゴリ選択 - 売買 */}
                        <div>
                            <p className="text-xs font-semibold text-orange-400 mb-2">🏠 売買カテゴリ</p>
                            <div className="flex flex-wrap gap-2">
                                {CATEGORIES.buy.map((cat) => {
                                    const Icon = cat.icon;
                                    const isSelected = selectedCategories.includes(cat.id);
                                    return (
                                        <Button
                                            key={cat.id}
                                            variant="outline"
                                            size="sm"
                                            onClick={() => toggleCategory(cat.id)}
                                            className={isSelected 
                                                ? `bg-gradient-to-r ${cat.color} text-white border-transparent shadow-lg transition-all duration-200 scale-105`
                                                : 'bg-slate-800/50 border-slate-700 text-slate-300 hover:bg-slate-700 hover:scale-102 transition-all duration-200'}
                                        >
                                            <Icon className="h-4 w-4 mr-1" />
                                            {cat.label}
                                        </Button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* 金額フィルター */}
                        <div className="pt-3 border-t border-slate-800">
                            <div className="flex items-center justify-between mb-3">
                                <p className="text-xs font-semibold text-emerald-400 flex items-center gap-1">
                                    <CircleDollarSign className="h-3 w-3" /> 金額で絞り込み
                                </p>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setPriceFilterEnabled(!priceFilterEnabled)}
                                    className={priceFilterEnabled
                                        ? 'bg-emerald-600 text-white border-emerald-500 text-xs px-2 py-1 h-7'
                                        : 'bg-slate-800/50 border-slate-700 text-slate-400 text-xs px-2 py-1 h-7'}
                                >
                                    {priceFilterEnabled ? 'ON' : 'OFF'}
                                </Button>
                            </div>
                            
                            {priceFilterEnabled && (
                                <div className="space-y-3">
                                    <div className="flex items-center gap-4">
                                        <div className="flex-1">
                                            <label className="text-xs text-slate-500 block mb-1">最低価格</label>
                                            <Input
                                                type="text"
                                                value={formatPrice(priceRange[0])}
                                                onChange={(e) => {
                                                    const parsed = parsePrice(e.target.value);
                                                    if (parsed !== null) {
                                                        setPriceRange([parsed, priceRange[1]]);
                                                    }
                                                }}
                                                className="bg-slate-800 border-slate-700 text-white text-sm"
                                                placeholder="0円"
                                            />
                                        </div>
                                        <span className="text-slate-500 pt-5">〜</span>
                                        <div className="flex-1">
                                            <label className="text-xs text-slate-500 block mb-1">最高価格</label>
                                            <Input
                                                type="text"
                                                value={formatPrice(priceRange[1])}
                                                onChange={(e) => {
                                                    const parsed = parsePrice(e.target.value);
                                                    if (parsed !== null) {
                                                        setPriceRange([priceRange[0], parsed]);
                                                    }
                                                }}
                                                className="bg-slate-800 border-slate-700 text-white text-sm"
                                                placeholder="5億円"
                                            />
                                        </div>
                                    </div>
                                    
                                    {/* クイック選択ボタン */}
                                    <div className="flex flex-wrap gap-2">
                                        <span className="text-xs text-slate-500 self-center">クイック:</span>
                                        {[
                                            { label: '〜3万', min: 0, max: 30000 },
                                            { label: '〜5万', min: 0, max: 50000 },
                                            { label: '〜8万', min: 0, max: 80000 },
                                            { label: '〜10万', min: 0, max: 100000 },
                                            { label: '〜500万', min: 0, max: 5000000 },
                                            { label: '〜1000万', min: 0, max: 10000000 },
                                            { label: '〜3000万', min: 0, max: 30000000 },
                                            { label: '〜5000万', min: 0, max: 50000000 },
                                            { label: '〜1億', min: 0, max: 100000000 },
                                        ].map((preset) => (
                                            <Button
                                                key={preset.label}
                                                variant="outline"
                                                size="sm"
                                                onClick={() => setPriceRange([preset.min, preset.max])}
                                                className={priceRange[0] === preset.min && priceRange[1] === preset.max
                                                    ? 'bg-emerald-600 text-white border-emerald-500 text-xs px-2 py-1 h-6'
                                                    : 'bg-slate-800/50 border-slate-700 text-slate-400 text-xs px-2 py-1 h-6 hover:bg-emerald-900/30'}
                                            >
                                                {preset.label}
                                            </Button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* テキスト検索 */}
                        <div className="relative pt-3 border-t border-slate-800">
                            <Search className="absolute left-3 top-1/2 mt-1.5 transform -translate-y-1/2 h-5 w-5 text-slate-400" />
                <Input
                    type="text"
                                placeholder="物件名、会社名、エリアなどで検索..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-10 bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 focus:border-emerald-500 focus:ring-emerald-500"
                />
                    </div>
                    </CardContent>
                </Card>
            )}

            {/* 結果カウント＆ページサイズ */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4 text-sm">
                    <Badge variant="secondary" className="bg-slate-800 text-slate-300">
                        {filteredProperties.length.toLocaleString()} 件ヒット
                    </Badge>
                    <Badge variant="secondary" className="bg-emerald-900/50 text-emerald-300">
                        販売中 {stats.active.toLocaleString()} 件
                    </Badge>
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500">表示件数:</span>
                    {PAGE_SIZE_OPTIONS.map((size) => (
                        <Button
                            key={size}
                            variant="outline"
                            size="sm"
                            onClick={() => { setItemsPerPage(size); setCurrentPage(1); }}
                            className={`h-7 px-2 text-xs ${
                                itemsPerPage === size
                                    ? 'bg-emerald-600 text-white border-emerald-500'
                                    : 'bg-slate-800/50 border-slate-700 text-slate-400 hover:bg-slate-700'
                            }`}
                        >
                            {size}
                        </Button>
                    ))}
                </div>
            </div>

            {/* ページネーション（上部） */}
            {totalPages > 1 && (
                <div className="flex items-center justify-center gap-1">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handlePageChange(1)}
                        disabled={currentPage === 1}
                        className="h-10 w-10 p-0 bg-slate-800/50 border-slate-700 text-slate-400 hover:bg-slate-700 disabled:opacity-50"
                    >
                        <ChevronsLeft className="h-4 w-4" />
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handlePageChange(currentPage - 1)}
                        disabled={currentPage === 1}
                        className="h-10 w-10 p-0 bg-slate-800/50 border-slate-700 text-slate-400 hover:bg-slate-700 disabled:opacity-50"
                    >
                        <ChevronLeft className="h-4 w-4" />
                    </Button>
                    
                    {getPageNumbers().map((page, idx) => (
                        typeof page === 'number' ? (
                            <Button
                                key={idx}
                                variant="outline"
                                size="sm"
                                onClick={() => handlePageChange(page)}
                                className={`h-10 min-w-[40px] px-3 text-sm ${
                                    currentPage === page
                                        ? 'bg-emerald-600 text-white border-emerald-500'
                                        : 'bg-slate-800/50 border-slate-700 text-slate-400 hover:bg-slate-700'
                                }`}
                            >
                                {page}
                            </Button>
                        ) : (
                            <span key={idx} className="px-2 text-slate-500">...</span>
                        )
                    ))}
                    
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handlePageChange(currentPage + 1)}
                        disabled={currentPage === totalPages}
                        className="h-10 w-10 p-0 bg-slate-800/50 border-slate-700 text-slate-400 hover:bg-slate-700 disabled:opacity-50"
                    >
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handlePageChange(totalPages)}
                        disabled={currentPage === totalPages}
                        className="h-10 w-10 p-0 bg-slate-800/50 border-slate-700 text-slate-400 hover:bg-slate-700 disabled:opacity-50"
                    >
                        <ChevronsRight className="h-4 w-4" />
                    </Button>
                    
                    <span className="ml-4 text-xs text-slate-500">
                        {startIndex + 1} - {Math.min(endIndex, filteredProperties.length)} / {filteredProperties.length.toLocaleString()}件
                    </span>
                </div>
            )}

            {/* テーブル */}
            <Card className="bg-slate-900/80 border-slate-800 backdrop-blur-sm">
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow className="border-slate-800 hover:bg-slate-900">
                                <TableHead className="text-slate-400">物件名</TableHead>
                                <TableHead className="text-slate-400">カテゴリ</TableHead>
                                <TableHead className="text-slate-400">価格</TableHead>
                                <TableHead className="text-slate-400">登録日</TableHead>
                                <TableHead className="text-slate-400">ステータス</TableHead>
                                <TableHead className="text-slate-400 text-right">アクション</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center py-10 text-slate-400">
                                        <div className="flex items-center justify-center gap-2">
                                            <div className="animate-spin h-5 w-5 border-2 border-emerald-500 rounded-full border-t-transparent"></div>
                                            読み込み中...
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ) : currentProperties.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center py-10 text-slate-400">
                                        <p className="mb-3">条件に一致する物件がありません</p>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={clearFilters}
                                            className="bg-slate-800/50 border-slate-700 text-slate-200 hover:bg-slate-700"
                                        >
                                            フィルターをクリア
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ) : currentProperties.map((property) => (
                                <TableRow
                                    key={property.url}
                                    className="border-slate-800 hover:bg-slate-800/50 cursor-pointer transition-colors"
                                    onClick={() => window.location.href = `/properties/${encodeURIComponent(property.url)}`}
                                >
                                    <TableCell className="font-medium text-white">
                                        <div className="flex flex-col">
                                            <span className="truncate max-w-[300px]">{property.title}</span>
                                            <span className="text-xs text-slate-500">{property.company_name}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant="secondary" className="bg-slate-800 text-slate-300">
                                            {property.category_name_ja} / {property.genre_name_ja}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-emerald-400 font-bold">{property.price}</TableCell>
                                    <TableCell className="text-slate-400 text-sm">{property.first_seen_date}</TableCell>
                                    <TableCell>
                                        <Badge className={property.is_active ? "bg-emerald-900 text-emerald-200" : "bg-red-900 text-red-200"}>
                                            {property.is_active ? "販売中" : "成約済"}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                                        <div className="flex justify-end space-x-2">
                                            <Link href={`/properties/${encodeURIComponent(property.url)}`}>
                                                <Button size="sm" variant="ghost" className="text-blue-400 hover:text-blue-300 hover:bg-blue-900/20">
                                                    <Sparkles className="h-4 w-4 mr-1" /> AI分析
                                                </Button>
                                            </Link>
                                            <a href={property.url} target="_blank" rel="noopener noreferrer">
                                                <Button size="sm" variant="ghost" className="text-slate-400 hover:text-white">
                                                    <ExternalLink className="h-4 w-4" />
                                                </Button>
                                            </a>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            {/* ページネーション（下部） */}
            {totalPages > 1 && (
                <div className="flex items-center justify-center gap-1 pb-8">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handlePageChange(1)}
                        disabled={currentPage === 1}
                        className="h-10 w-10 p-0 bg-slate-800/50 border-slate-700 text-slate-400 hover:bg-slate-700 disabled:opacity-50"
                    >
                        <ChevronsLeft className="h-4 w-4" />
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handlePageChange(currentPage - 1)}
                        disabled={currentPage === 1}
                        className="h-10 w-10 p-0 bg-slate-800/50 border-slate-700 text-slate-400 hover:bg-slate-700 disabled:opacity-50"
                    >
                        <ChevronLeft className="h-4 w-4" />
                    </Button>
                    
                    {getPageNumbers().map((page, idx) => (
                        typeof page === 'number' ? (
                            <Button
                                key={idx}
                                variant="outline"
                                size="sm"
                                onClick={() => handlePageChange(page)}
                                className={`h-10 min-w-[40px] px-3 text-sm ${
                                    currentPage === page
                                        ? 'bg-emerald-600 text-white border-emerald-500'
                                        : 'bg-slate-800/50 border-slate-700 text-slate-400 hover:bg-slate-700'
                                }`}
                            >
                                {page}
                            </Button>
                        ) : (
                            <span key={idx} className="px-2 text-slate-500">...</span>
                        )
                    ))}
                    
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handlePageChange(currentPage + 1)}
                        disabled={currentPage === totalPages}
                        className="h-10 w-10 p-0 bg-slate-800/50 border-slate-700 text-slate-400 hover:bg-slate-700 disabled:opacity-50"
                    >
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handlePageChange(totalPages)}
                        disabled={currentPage === totalPages}
                        className="h-10 w-10 p-0 bg-slate-800/50 border-slate-700 text-slate-400 hover:bg-slate-700 disabled:opacity-50"
                    >
                        <ChevronsRight className="h-4 w-4" />
                    </Button>
                    
                    <span className="ml-4 text-xs text-slate-500">
                        {startIndex + 1} - {Math.min(endIndex, filteredProperties.length)} / {filteredProperties.length.toLocaleString()}件
                    </span>
                </div>
            )}
        </div>
    );
}
