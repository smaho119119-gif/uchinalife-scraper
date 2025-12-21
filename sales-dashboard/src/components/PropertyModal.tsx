'use client';

import { useEffect, useState } from 'react';
import { X, MapPin, Home, Calendar, TrendingUp, ExternalLink, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { propertyCache } from '@/lib/propertyCache';

interface Property {
    url: string;
    title: string;
    price: string;
    address: string;
    category: string;
    created_at: string;
    updated_at: string;
    is_active: boolean;
    property_data?: any;
    details?: any;
}

interface PropertyModalProps {
    isOpen: boolean;
    onClose: () => void;
    filter: 'active' | 'newToday' | 'soldToday' | 'inactive' | 'total';
    title: string;
    category?: string;
}

const CATEGORY_NAMES: Record<string, string> = {
    jukyo: '賃貸_住居',
    jigyo: '賃貸_事業用',
    yard: '賃貸_月極駐車場',
    parking: '賃貸_時間貸駐車場',
    tochi: '売買_土地',
    mansion: '売買_マンション',
    house: '売買_戸建',
    sonota: '売買_その他',
};

export default function PropertyModal({ isOpen, onClose, filter, title, category }: PropertyModalProps) {
    const [properties, setProperties] = useState<Property[]>([]);
    const [loading, setLoading] = useState(false);
    const [selectedCategory, setSelectedCategory] = useState<string>(category || '');
    const [selectedType, setSelectedType] = useState<'all' | 'rental' | 'sale'>('all');
    const [cacheStatus, setCacheStatus] = useState<'none' | 'cached' | 'loading'>('none');

    useEffect(() => {
        if (isOpen) {
            fetchProperties();
        }
    }, [isOpen, filter, selectedCategory]);

    const getCacheKey = () => {
        return `${filter}-${selectedCategory || 'all'}`;
    };

    const fetchProperties = async () => {
        const cacheKey = getCacheKey();

        // Check if we have valid cached data
        const cachedData = propertyCache.get<Property[]>(cacheKey);
        if (cachedData) {
            setProperties(cachedData);
            setCacheStatus('cached');
            return;
        }

        setLoading(true);
        setCacheStatus('loading');
        try {
            let url = `/api/analytics/properties?limit=100`;

            if (filter !== 'total') {
                url += `&filter=${filter}`;
            }

            if (selectedCategory) {
                url += `&category=${selectedCategory}`;
            }

            const response = await fetch(url);
            const data = await response.json();
            const fetchedProperties = data.properties || [];

            // Update global cache
            propertyCache.set(cacheKey, fetchedProperties);
            setProperties(fetchedProperties);
            setCacheStatus('cached');
        } catch (error) {
            console.error('Failed to fetch properties:', error);
            setCacheStatus('none');
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 overflow-hidden">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="absolute inset-0 flex items-center justify-center p-4">
                <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden animate-in fade-in zoom-in duration-200">
                    {/* Header */}
                    <div className="sticky top-0 z-10 bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4 flex items-center justify-between">
                        <div>
                            <h2 className="text-2xl font-bold text-white">{title}</h2>
                            <p className="text-blue-100 text-sm mt-1">
                                {loading ? '読み込み中...' : `${properties.length}件の物件`}
                                {!loading && cacheStatus === 'cached' && (
                                    <span className="ml-2 text-xs opacity-75">
                                        (キャッシュ済み)
                                    </span>
                                )}
                            </p>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => {
                                    const cacheKey = getCacheKey();
                                    propertyCache.clear(cacheKey);
                                    fetchProperties();
                                }}
                                className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                                title="データを再読み込み"
                            >
                                <RefreshCw className={`w-5 h-5 text-white ${loading ? 'animate-spin' : ''}`} />
                            </button>
                            <button
                                onClick={onClose}
                                className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                            >
                                <X className="w-6 h-6 text-white" />
                            </button>
                        </div>
                    </div>

                    {/* Type and Category Filters */}
                    <div className="sticky top-[72px] z-10 bg-white border-b border-gray-200 px-6 py-4 space-y-3">
                        {/* Type Filter */}
                        <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-gray-700 mr-2">種別:</span>
                            <button
                                onClick={() => {
                                    setSelectedType('all');
                                    setSelectedCategory('');
                                }}
                                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${selectedType === 'all'
                                    ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md'
                                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                    }`}
                            >
                                すべて
                            </button>
                            <button
                                onClick={() => {
                                    setSelectedType('rental');
                                    setSelectedCategory('');
                                }}
                                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${selectedType === 'rental'
                                    ? 'bg-gradient-to-r from-green-600 to-emerald-600 text-white shadow-md'
                                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                    }`}
                            >
                                🏠 賃貸
                            </button>
                            <button
                                onClick={() => {
                                    setSelectedType('sale');
                                    setSelectedCategory('');
                                }}
                                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${selectedType === 'sale'
                                    ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-md'
                                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                    }`}
                            >
                                🏘️ 売買
                            </button>
                        </div>

                        {/* Category Filter */}
                        <div className="flex items-center gap-2 overflow-x-auto pb-1">
                            <span className="text-sm font-medium text-gray-700 mr-2">カテゴリ:</span>
                            {selectedType === 'all' && (
                                <button
                                    onClick={() => setSelectedCategory('')}
                                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${selectedCategory === ''
                                        ? 'bg-blue-600 text-white'
                                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                        }`}
                                >
                                    すべて
                                </button>
                            )}
                            {Object.entries(CATEGORY_NAMES)
                                .filter(([id]) => {
                                    if (selectedType === 'rental') {
                                        return ['jukyo', 'jigyo', 'yard', 'parking'].includes(id);
                                    }
                                    if (selectedType === 'sale') {
                                        return ['tochi', 'mansion', 'house', 'sonota'].includes(id);
                                    }
                                    return true;
                                })
                                .map(([id, name]) => (
                                    <button
                                        key={id}
                                        onClick={() => setSelectedCategory(id)}
                                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${selectedCategory === id
                                            ? 'bg-blue-600 text-white'
                                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                            }`}
                                    >
                                        {name.replace('賃貸_', '').replace('売買_', '')}
                                    </button>
                                ))}
                        </div>
                    </div>

                    {/* Content */}
                    <div className="overflow-y-auto max-h-[calc(90vh-140px)] p-6">
                        {loading ? (
                            <div className="flex items-center justify-center py-12">
                                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                            </div>
                        ) : properties.length === 0 ? (
                            <div className="text-center py-12">
                                <Home className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                                <p className="text-gray-500 text-lg">物件が見つかりませんでした</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {properties.map((property) => (
                                    <PropertyCard key={property.url} property={property} />
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

function PropertyCard({ property }: { property: Property }) {
    const categoryName = CATEGORY_NAMES[property.category] || property.category;
    const isRental = ['jukyo', 'jigyo', 'yard', 'parking'].includes(property.category);

    // Extract price from property_data if not in price field
    let displayPrice = property.price;
    if (!displayPrice || displayPrice === '価格未定') {
        // Try property_data first
        const dataSource = property.property_data || property.details;

        if (dataSource) {
            const propertyData = typeof dataSource === 'string'
                ? JSON.parse(dataSource)
                : dataSource;

            // Try different price field names
            displayPrice = propertyData['家賃'] ||
                propertyData['価格'] ||
                propertyData['販売価格'] ||
                propertyData['賃料'] ||
                '価格未定';
        }
    }

    return (
        <Link
            href={`/properties/${encodeURIComponent(property.url)}`}
            className="block group"
        >
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
                {/* Status Badge */}
                <div className="relative bg-gradient-to-br from-gray-50 to-gray-100 p-4">
                    <div className="absolute top-2 right-2">
                        {property.is_active ? (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                アクティブ
                            </span>
                        ) : (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                売却済み
                            </span>
                        )}
                    </div>
                    <div className="pt-6">
                        <div className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            {categoryName}
                        </div>
                    </div>
                </div>

                {/* Content */}
                <div className="p-4">
                    <h3 className="font-semibold text-gray-900 mb-2 line-clamp-2 group-hover:text-blue-600 transition-colors">
                        {property.title || '物件詳細'}
                    </h3>

                    {/* Price */}
                    <div className="mb-3">
                        <p className="text-2xl font-bold text-blue-600">
                            {displayPrice}
                        </p>
                    </div>

                    {/* Address */}
                    {property.address && (
                        <div className="flex items-start gap-2 mb-3">
                            <MapPin className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                            <p className="text-sm text-gray-600 line-clamp-2">{property.address}</p>
                        </div>
                    )}

                    {/* Dates */}
                    <div className="space-y-1 text-xs text-gray-500">
                        <div className="flex items-center gap-2">
                            <Calendar className="w-3 h-3" />
                            <span>登録: {new Date(property.created_at).toLocaleDateString('ja-JP')}</span>
                        </div>
                        {property.updated_at !== property.created_at && (
                            <div className="flex items-center gap-2">
                                <TrendingUp className="w-3 h-3" />
                                <span>更新: {new Date(property.updated_at).toLocaleDateString('ja-JP')}</span>
                            </div>
                        )}
                    </div>

                    {/* View Details Link */}
                    <div className="mt-4 pt-4 border-t border-gray-100">
                        <div className="flex items-center justify-between text-sm">
                            <span className="text-blue-600 font-medium group-hover:underline">
                                詳細を見る
                            </span>
                            <ExternalLink className="w-4 h-4 text-blue-600" />
                        </div>
                    </div>
                </div>
            </div>
        </Link>
    );
}
