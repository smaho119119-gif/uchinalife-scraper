"use client";

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { toast } from 'sonner';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Sparkles, Copy, ExternalLink, Image as ImageIcon, Loader2, ArrowLeft, Calendar, Heart, History, RotateCcw, X, ZoomIn, TrendingUp, BarChart3 } from 'lucide-react';
import { ImageGenerator } from "@/components/ImageGenerator";

interface CopyHistory {
    id: number;
    copy_text: string;
    created_at: string;
    is_active: number;
}

export default function PropertyDetailPage() {
    const params = useParams();
    const router = useRouter();
    const url = decodeURIComponent(Array.isArray(params.url) ? params.url.join('/') : params.url as string);

    const [property, setProperty] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [aiCopy, setAiCopy] = useState("");
    const [generating, setGenerating] = useState(false);
    const [selectedImage, setSelectedImage] = useState(0);
    const [imageDialogOpen, setImageDialogOpen] = useState(false);
    const [copyHistory, setCopyHistory] = useState<CopyHistory[]>([]);
    const [showHistory, setShowHistory] = useState(false);

    // AI Model selection
    const [textModel, setTextModel] = useState('gemini-3-pro'); // テキスト生成モデル

    // 人気分析
    const [popularityAnalysis, setPopularityAnalysis] = useState<string>('');
    const [analysisStats, setAnalysisStats] = useState<any>(null);
    const [analyzingPopularity, setAnalyzingPopularity] = useState(false);

    // Image generation state
    const [generatingImage, setGeneratingImage] = useState(false);
    const [generatedImage, setGeneratedImage] = useState<string | null>(null);
    const [imageGallery, setImageGallery] = useState<Array<{ url: string, mode: string, style: string, timestamp: number }>>([]);
    const [imageMode, setImageMode] = useState('sns_banner');
    const [imageStyle, setImageStyle] = useState('modern');
    const [imageSize, setImageSize] = useState('2K');
    const [imageAspectRatio, setImageAspectRatio] = useState('16:9');

    // Property image selection
    const [selectedPropertyImages, setSelectedPropertyImages] = useState<string[]>([]);
    const [staffPhoto, setStaffPhoto] = useState<string | null>(null);
    const [staffPhotoFile, setStaffPhotoFile] = useState<File | null>(null);

    useEffect(() => {
        // プリフェッチされたキャッシュを活用
        fetch(`/api/properties/${encodeURIComponent(url)}`, {
            cache: 'force-cache' // キャッシュがあれば即座に使用
        })
            .then(async (res) => {
                if (!res.ok) throw new Error(`fetch failed: ${res.status}`);
                const data = await res.json();
                if (data && typeof data === 'object' && !('error' in data)) {
                    setProperty(data);
                }
            })
            .catch((err) => {
                console.error('failed to load property', err);
            })
            .finally(() => {
                setLoading(false);
            });

        // Load history (プリフェッチされたキャッシュを活用)
        loadHistory();

        // Load generated images history
        loadImageHistory();
    }, [url]);

    const loadHistory = async () => {
        try {
            // プリフェッチされたキャッシュを活用
            const res = await fetch('/api/ai/history', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url }),
                cache: 'force-cache'
            });
            const data = await res.json();
            setCopyHistory(data.history || []);

            // Set the most recent copy as current
            if (data.history && data.history.length > 0) {
                setAiCopy(data.history[0].copy_text);
            }
        } catch (e) {
            console.error("Failed to load history");
        }
    };

    // 生成画像履歴を読み込む
    const loadImageHistory = async () => {
        try {
            const res = await fetch(`/api/ai/generated-images?url=${encodeURIComponent(url)}`);
            const data = await res.json();

            if (data.images && Array.isArray(data.images) && data.images.length > 0) {
                setImageGallery(data.images);
                // 最新の生成画像を表示
                setGeneratedImage(data.images[0].url);
            }
        } catch (e) {
            console.error("Failed to load image history:", e);
        }
    };

    const handleGenerateCopy = async () => {
        setGenerating(true);
        try {
            const res = await fetch('/api/ai/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: property.url, model: textModel })
            });
            const data = await res.json();
            setAiCopy(data.copy);

            // Reload history to show the new entry
            await loadHistory();
        } catch (e) {
            console.error('Generate copy failed:', e);
            toast.error('セールスコピーの生成に失敗しました', {
                description: 'しばらく待ってから再度お試しください。',
            });
        } finally {
            setGenerating(false);
        }
    };

    const handleGenerateImage = async () => {
        setGeneratingImage(true);
        try {
            // Prepare form data for multipart upload
            const formData = new FormData();
            formData.append('url', property.url);
            formData.append('mode', imageMode);
            formData.append('style', imageStyle);
            formData.append('size', imageSize);
            formData.append('aspectRatio', imageAspectRatio);
            formData.append('propertyImages', JSON.stringify(selectedPropertyImages));

            if (staffPhotoFile) {
                formData.append('staffPhoto', staffPhotoFile);
            }

            const res = await fetch('/api/ai/generate-image', {
                method: 'POST',
                body: formData,
            });
            const data = await res.json();

            if (data.imageUrl) {
                // Use the local file URL
                setGeneratedImage(data.imageUrl);

                // Add to gallery
                setImageGallery(prev => [{
                    url: data.imageUrl,
                    mode: imageMode,
                    style: imageStyle,
                    timestamp: Date.now()
                }, ...prev]);
            }
        } catch (e) {
            console.error('Generate image failed:', e);
            toast.error('画像の生成に失敗しました', {
                description: '条件を変えて再度お試しください。',
            });
        } finally {
            setGeneratingImage(false);
        }
    };

    const handleStaffPhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setStaffPhotoFile(file);
            const reader = new FileReader();
            reader.onloadend = () => {
                setStaffPhoto(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    const togglePropertyImage = (imageUrl: string) => {
        setSelectedPropertyImages(prev =>
            prev.includes(imageUrl)
                ? prev.filter(url => url !== imageUrl)
                : [...prev, imageUrl]
        );
    };

    const restoreVersion = (copyText: string) => {
        setAiCopy(copyText);
        setShowHistory(false);
    };

    // 人気分析を生成
    const handleAnalyzePopularity = async () => {
        setAnalyzingPopularity(true);
        try {
            const res = await fetch('/api/ai/analyze-popularity', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: property.url, model: textModel })
            });
            const data = await res.json();
            setPopularityAnalysis(data.analysis);
            setAnalysisStats(data.stats);
        } catch (e) {
            console.error('Analyze popularity failed:', e);
            toast.error('人気分析の生成に失敗しました', {
                description: 'しばらく待ってから再度お試しください。',
            });
        } finally {
            setAnalyzingPopularity(false);
        }
    };

    // ローディング中はスケルトンUIを表示（体感速度向上）
    if (loading) return (
        <div className="min-h-screen bg-slate-950">
            {/* Hero Skeleton */}
            <div className="relative w-full bg-slate-900">
                <div className="aspect-[21/9] md:aspect-[21/7] lg:aspect-[21/6] w-full bg-slate-800 animate-pulse" />
            </div>

            {/* Content Skeleton */}
            <div className="max-w-7xl mx-auto px-4 py-8">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Main Content Skeleton */}
                    <div className="lg:col-span-2 space-y-6">
                        <div className="bg-slate-900 rounded-lg p-6">
                            <div className="h-8 bg-slate-800 rounded w-3/4 mb-4 animate-pulse" />
                            <div className="h-4 bg-slate-800 rounded w-1/2 mb-2 animate-pulse" />
                            <div className="h-4 bg-slate-800 rounded w-2/3 animate-pulse" />
                        </div>
                        <div className="bg-slate-900 rounded-lg p-6 h-64 animate-pulse" />
                    </div>

                    {/* Sidebar Skeleton */}
                    <div className="space-y-6">
                        <div className="bg-slate-900 rounded-lg p-6 h-48 animate-pulse" />
                        <div className="bg-slate-900 rounded-lg p-6 h-32 animate-pulse" />
                    </div>
                </div>
            </div>
        </div>
    );

    if (!property) return (
        <div className="flex items-center justify-center min-h-screen bg-slate-950 text-white">
            物件が見つかりませんでした
        </div>
    );

    const images = property.images && property.images.length > 0 ? property.images : [];

    return (
        <div className="flex h-screen bg-slate-950 overflow-hidden">
            {/* 左側: 物件情報（スクロール可能） */}
            <div className="flex-1 overflow-y-auto">
                {/* 戻るボタン */}
                <div className="sticky top-0 z-20 bg-slate-950/90 backdrop-blur-sm p-3 border-b border-slate-800">
                    <Button
                        variant="ghost"
                        size="sm"
                        className="bg-slate-800 text-white hover:bg-slate-700"
                        onClick={() => router.back()}
                    >
                        <ArrowLeft className="mr-2 h-4 w-4" /> 戻る
                    </Button>
                </div>

                {/* 画像ギャラリー（生成画像も含む） */}
                <div className="relative bg-slate-900">
                    {(() => {
                        // 生成画像と物件画像を結合（生成画像を先頭に）
                        const generatedImageUrls = imageGallery.map(img => img.url);
                        const allImages = [...generatedImageUrls, ...images];
                        const currentImage = allImages[selectedImage] || images[0];
                        const isGeneratedImage = selectedImage < generatedImageUrls.length;

                        return allImages.length > 0 ? (
                            <div className="relative">
                                <div
                                    className="aspect-[21/9] w-full overflow-hidden bg-slate-950 cursor-pointer group"
                                    onClick={() => setImageDialogOpen(true)}
                                >
                                    <img
                                        src={currentImage}
                                        alt={property.title}
                                        className="w-full h-full object-cover transition-transform group-hover:scale-105"
                                        onError={(e) => {
                                            // 画像読み込みエラー時にプレースホルダーを表示
                                            const target = e.target as HTMLImageElement;
                                            target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iODAwIiBoZWlnaHQ9IjQ1MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZGVmcz48bGluZWFyR3JhZGllbnQgaWQ9ImciIHgxPSIwJSIgeTE9IjAlIiB4Mj0iMCUiIHkyPSIxMDAlIj48c3RvcCBvZmZzZXQ9IjAlIiBzdHlsZT0ic3RvcC1jb2xvcjojMWUyOTNiO3N0b3Atb3BhY2l0eToxIi8+PHN0b3Agb2Zmc2V0PSIxMDAlIiBzdHlsZT0ic3RvcC1jb2xvcjojMGYxNzJhO3N0b3Atb3BhY2l0eToxIi8+PC9saW5lYXJHcmFkaWVudD48L2RlZnM+PHJlY3Qgd2lkdGg9IjgwMCIgaGVpZ2h0PSI0NTAiIGZpbGw9InVybCgjZykiLz48dGV4dCB4PSI1MCUiIHk9IjQ1JSIgZm9udC1mYW1pbHk9IkFyaWFsLCBzYW5zLXNlcmlmIiBmb250LXNpemU9IjI0IiBmaWxsPSIjNjQ3NDhiIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIj7nlLvlg4/jgarjgZc8L3RleHQ+PHRleHQgeD0iNTAlIiB5PSI1NSUiIGZvbnQtZmFtaWx5PSJBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIxNCIgZmlsbD0iIzQ3NTU2OSIgdGV4dC1hbmNob3I9Im1pZGRsZSI+KOaIkOe0hea4iOOBvuOBn+OBr+WJiumZpOa4iOOBvyk8L3RleHQ+PC9zdmc+';
                                            target.onerror = null; // 無限ループ防止
                                        }}
                                    />
                                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                                        <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 rounded-full p-2">
                                            <ZoomIn className="h-6 w-6 text-slate-900" />
                                        </div>
                                    </div>
                                    {/* 生成画像バッジ */}
                                    {isGeneratedImage && (
                                        <div className="absolute top-2 left-2 bg-emerald-500/90 text-white text-xs px-2 py-1 rounded-full font-bold">
                                            🎨 AI生成
                                        </div>
                                    )}
                                </div>

                                {/* サムネイル（生成画像＋物件画像） */}
                                {allImages.length > 1 && (
                                    <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2 flex gap-1 p-1.5 bg-slate-900/80 backdrop-blur-md rounded-lg">
                                        {/* 生成画像サムネイル */}
                                        {generatedImageUrls.slice(0, 3).map((img: string, idx: number) => (
                                            <button
                                                key={`gen-${idx}`}
                                                onClick={() => setSelectedImage(idx)}
                                                className={`relative w-12 h-12 rounded overflow-hidden border-2 transition-all ${selectedImage === idx ? 'border-emerald-500' : 'border-emerald-700/50 opacity-80 hover:opacity-100'}`}
                                            >
                                                <img src={img} alt={`Generated ${idx + 1}`} className="w-full h-full object-cover" />
                                                <div className="absolute bottom-0 right-0 bg-emerald-500 text-white text-[8px] px-1 rounded-tl">
                                                    AI
                                                </div>
                                            </button>
                                        ))}
                                        {/* 区切り線 */}
                                        {generatedImageUrls.length > 0 && images.length > 0 && (
                                            <div className="w-px bg-slate-600 mx-1" />
                                        )}
                                        {/* 物件画像サムネイル */}
                                        {images.slice(0, 5).map((img: string, idx: number) => (
                                            <button
                                                key={`prop-${idx}`}
                                                onClick={() => setSelectedImage(generatedImageUrls.length + idx)}
                                                className={`w-12 h-12 rounded overflow-hidden border-2 transition-all ${selectedImage === (generatedImageUrls.length + idx) ? 'border-emerald-500' : 'border-slate-700 opacity-60 hover:opacity-100'}`}
                                            >
                                                <img src={img} alt={`Thumbnail ${idx + 1}`} className="w-full h-full object-cover" />
                                            </button>
                                        ))}
                                        {images.length > 5 && (
                                            <div className="w-12 h-12 rounded bg-slate-800 flex items-center justify-center text-slate-400 text-xs">
                                                +{images.length - 5}
                                            </div>
                                        )}
                                    </div>
                                )}

                                <Dialog open={imageDialogOpen} onOpenChange={setImageDialogOpen}>
                                    <DialogContent className="max-w-[95vw] max-h-[95vh] w-auto p-0 bg-transparent border-0 shadow-none" showCloseButton={false}>
                                        <div className="relative bg-black/95 rounded-lg overflow-hidden">
                                            <button onClick={() => setImageDialogOpen(false)} className="absolute top-4 right-4 z-50 bg-white/10 hover:bg-white/20 rounded-full p-2">
                                                <X className="h-6 w-6 text-white" />
                                            </button>
                                            <img src={currentImage} alt={property.title} className="max-w-full max-h-[90vh] object-contain mx-auto" />
                                        </div>
                                    </DialogContent>
                                </Dialog>
                            </div>
                        ) : (
                            <div className="aspect-[21/9] w-full bg-slate-950 flex items-center justify-center">
                                <div className="text-slate-500 flex flex-col items-center">
                                    <ImageIcon className="h-12 w-12 mb-2" />
                                    <p className="text-sm">画像なし</p>
                                </div>
                            </div>
                        );
                    })()}
                </div>

                {/* 物件情報 */}
                <div className="p-4 space-y-4">
                    {/* タイトル & 価格 */}
                    <Card className="bg-slate-900 border-slate-800">
                        <CardHeader className="p-4">
                            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                                <div className="flex-1">
                                    <div className="flex flex-wrap items-center gap-1.5 mb-2">
                                        <Badge variant="outline" className="text-slate-300 border-slate-700 text-xs">
                                            {property.category_name_ja}
                                        </Badge>
                                        <Badge variant="outline" className="text-slate-300 border-slate-700 text-xs">
                                            {property.genre_name_ja}
                                        </Badge>
                                        <Badge className={`text-xs ${property.is_active ? "bg-emerald-900 text-emerald-200" : "bg-red-900 text-red-200"}`}>
                                            {property.is_active ? "販売中" : "成約済"}
                                        </Badge>
                                    </div>
                                    <CardTitle className="text-xl text-white mb-1">{property.title}</CardTitle>
                                    <div className="flex items-center text-slate-400 text-xs space-x-3">
                                        <span className="flex items-center">
                                            <Calendar className="h-3 w-3 mr-1" />
                                            {property.first_seen_date}
                                        </span>
                                        <span className="flex items-center">
                                            <Heart className="h-3 w-3 mr-1" />
                                            {property.favorites || 0}
                                        </span>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="text-2xl font-bold text-emerald-400">{property.price}</div>
                                    <a href={property.url} target="_blank" rel="noopener noreferrer">
                                        <Button variant="outline" size="sm" className="mt-1 h-7 text-xs border-slate-700 text-slate-300 hover:bg-slate-800">
                                            <ExternalLink className="mr-1 h-3 w-3" /> 元のページ
                                        </Button>
                                    </a>
                                </div>
                            </div>
                        </CardHeader>
                    </Card>

                    {/* 物件詳細 */}
                    <Card className="bg-slate-900 border-slate-800">
                        <CardHeader className="p-4 pb-2">
                            <CardTitle className="text-white text-base">物件詳細情報</CardTitle>
                        </CardHeader>
                        <CardContent className="p-4 pt-0">
                            <div className="grid grid-cols-2 gap-3">
                                {property.property_data && Object.entries(property.property_data).map(([key, value]: [string, any]) => (
                                    <div key={key} className="border-b border-slate-800 pb-2">
                                        <p className="text-xs text-slate-500">{key}</p>
                                        <p className="text-sm text-slate-200 font-medium">{value}</p>
                                    </div>
                                ))}
                                {!property.property_data && (
                                    <div className="col-span-2 text-center text-slate-500 text-sm py-4">
                                        詳細情報がありません
                                    </div>
                                )}
                            </div>
                            <div className="mt-4 pt-3 border-t border-slate-800">
                                <p className="text-xs text-slate-500">不動産会社</p>
                                <p className="text-sm text-slate-200 font-medium">{property.company_name}</p>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>

            {/* 右側: AIアシスタント（固定サイドバー） */}
            <div className="w-[380px] flex-shrink-0 h-screen bg-slate-900 border-l border-slate-800 overflow-y-auto">
                <div className="p-4">
                    {/* ヘッダー */}
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <h2 className="flex items-center text-white font-bold">
                                <Sparkles className="mr-2 h-5 w-5 text-purple-500" />
                                AI営業アシスタント
                            </h2>
                            <p className="text-slate-400 text-xs mt-0.5">営業資料を瞬時に生成</p>
                        </div>
                        {copyHistory.length > 0 && (
                            <Button variant="ghost" size="sm" onClick={() => setShowHistory(!showHistory)} className="text-slate-400 hover:text-white h-7 text-xs">
                                <History className="h-3 w-3 mr-1" />
                                履歴 ({copyHistory.length})
                            </Button>
                        )}
                    </div>

                    {/* コンテンツ */}
                    <div className="space-y-4">
                        {showHistory ? (
                            <div className="space-y-2">
                                <div className="flex items-center justify-between mb-2">
                                    <h3 className="text-sm font-semibold text-white">生成履歴</h3>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => setShowHistory(false)}
                                        className="text-slate-400"
                                    >
                                        閉じる
                                    </Button>
                                </div>
                                <div className="max-h-[500px] overflow-y-auto space-y-2">
                                    {copyHistory.map((item, idx) => (
                                        <Card key={item.id} className="bg-slate-950 border-slate-700 hover:border-emerald-600 transition-colors cursor-pointer">
                                            <CardContent className="p-3" onClick={() => restoreVersion(item.copy_text)}>
                                                <div className="flex items-center justify-between mb-2">
                                                    <span className="text-xs text-slate-500">
                                                        {new Date(item.created_at).toLocaleString('ja-JP')}
                                                    </span>
                                                    {idx === 0 && (
                                                        <Badge className="bg-emerald-900 text-emerald-200 text-xs">最新</Badge>
                                                    )}
                                                </div>
                                                <p className="text-xs text-slate-300 line-clamp-3">
                                                    {item.copy_text.substring(0, 100)}...
                                                </p>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="mt-2 w-full text-xs text-blue-400 hover:text-blue-300"
                                                >
                                                    <RotateCcw className="h-3 w-3 mr-1" /> この版を使用
                                                </Button>
                                            </CardContent>
                                        </Card>
                                    ))}
                                </div>
                            </div>
                        ) : (
                            <Tabs defaultValue="analysis" className="w-full">
                                {/* コンパクトなタブUI */}
                                <TabsList className="grid w-full grid-cols-3 gap-1 bg-slate-800 p-1 rounded-lg h-auto">
                                    <TabsTrigger
                                        value="analysis"
                                        className="flex items-center justify-center gap-1 py-2 px-2 rounded-md text-xs font-bold transition-all
                                                    data-[state=active]:bg-gradient-to-r data-[state=active]:from-orange-500 data-[state=active]:to-red-500 
                                                    data-[state=active]:text-white data-[state=active]:shadow-md
                                                    data-[state=inactive]:bg-transparent data-[state=inactive]:text-slate-400
                                                    data-[state=inactive]:hover:text-white"
                                    >
                                        <TrendingUp className="h-3 w-3" />
                                        分析
                                    </TabsTrigger>
                                    <TabsTrigger
                                        value="copy"
                                        className="flex items-center justify-center gap-1 py-2 px-2 rounded-md text-xs font-bold transition-all
                                                    data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-600 data-[state=active]:to-blue-600 
                                                    data-[state=active]:text-white data-[state=active]:shadow-md
                                                    data-[state=inactive]:bg-transparent data-[state=inactive]:text-slate-400
                                                    data-[state=inactive]:hover:text-white"
                                    >
                                        <Sparkles className="h-3 w-3" />
                                        コピー
                                    </TabsTrigger>
                                    <TabsTrigger
                                        value="image"
                                        className="flex items-center justify-center gap-1 py-2 px-2 rounded-md text-xs font-bold transition-all
                                                    data-[state=active]:bg-gradient-to-r data-[state=active]:from-emerald-600 data-[state=active]:to-cyan-600 
                                                    data-[state=active]:text-white data-[state=active]:shadow-md
                                                    data-[state=inactive]:bg-transparent data-[state=inactive]:text-slate-400
                                                    data-[state=inactive]:hover:text-white"
                                    >
                                        <ImageIcon className="h-3 w-3" />
                                        画像
                                    </TabsTrigger>
                                </TabsList>

                                {/* 人気分析タブ */}
                                <TabsContent value="analysis" className="space-y-3 mt-4">
                                    {/* AIモデル選択 */}
                                    <div>
                                        <label className="text-slate-400 text-xs mb-1 block">🤖 AIモデル</label>
                                        <select
                                            className="w-full bg-slate-950 border border-orange-700 rounded p-1.5 text-slate-200 text-xs font-medium"
                                            value={textModel}
                                            onChange={(e) => setTextModel(e.target.value)}
                                        >
                                            <option value="gemini-3-pro">🚀 Gemini 3 Pro（最新・最高品質）</option>
                                            <option value="gemini-2.5-flash">⚡ Gemini 2.5 Flash（高速・低コスト）</option>
                                            <option value="gpt-4o-mini">🔷 GPT-4o Mini（OpenAI・高速）</option>
                                        </select>
                                    </div>

                                    <Button
                                        onClick={handleAnalyzePopularity}
                                        disabled={analyzingPopularity}
                                        className="w-full h-10 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white border-0 rounded-lg font-bold text-sm shadow-md"
                                    >
                                        {analyzingPopularity ? (
                                            <>
                                                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> 分析中...
                                            </>
                                        ) : (
                                            <>
                                                <BarChart3 className="mr-2 h-4 w-4" /> 人気の理由を分析
                                            </>
                                        )}
                                    </Button>

                                    {/* 統計情報 */}
                                    {analysisStats && (
                                        <div className="grid grid-cols-2 gap-2 p-3 bg-slate-800/50 rounded-lg border border-slate-700">
                                            <div className="text-center p-2 bg-slate-900 rounded">
                                                <div className="text-xs text-slate-400">エリア</div>
                                                <div className="text-sm font-bold text-orange-400">{analysisStats.city || '沖縄県'}</div>
                                            </div>
                                            <div className="text-center p-2 bg-slate-900 rounded">
                                                <div className="text-xs text-slate-400">類似物件数</div>
                                                <div className="text-sm font-bold text-orange-400">{analysisStats.similarCount || 0}件</div>
                                            </div>
                                            <div className="text-center p-2 bg-slate-900 rounded">
                                                <div className="text-xs text-slate-400">相場平均</div>
                                                <div className="text-sm font-bold text-emerald-400">
                                                    {analysisStats.avgPrice ? `${Math.round(analysisStats.avgPrice / 10000).toLocaleString()}万円` : '-'}
                                                </div>
                                            </div>
                                            <div className="text-center p-2 bg-slate-900 rounded">
                                                <div className="text-xs text-slate-400">価格評価</div>
                                                <div className={`text-sm font-bold ${analysisStats.pricePosition?.includes('安') ? 'text-emerald-400' :
                                                    analysisStats.pricePosition?.includes('高') ? 'text-red-400' : 'text-slate-300'
                                                    }`}>
                                                    {analysisStats.pricePosition || '-'}
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* 人気ポイント */}
                                    {analysisStats?.popularPoints && analysisStats.popularPoints.length > 0 && (
                                        <div className="p-3 bg-gradient-to-r from-orange-900/30 to-red-900/30 rounded-lg border border-orange-700/50">
                                            <div className="text-xs font-bold text-orange-400 mb-2">🔥 この物件の魅力ポイント</div>
                                            <div className="space-y-1">
                                                {analysisStats.popularPoints.map((point: string, idx: number) => (
                                                    <div key={idx} className="text-xs text-slate-200">{point}</div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {popularityAnalysis && (
                                        <div className="space-y-2 p-3 bg-slate-800/50 rounded-lg border border-slate-700">
                                            <div className="flex items-center justify-between">
                                                <span className="text-sm font-bold text-white">📊 AI分析レポート</span>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-7 px-3 text-xs text-orange-400 hover:text-orange-300 bg-orange-500/10"
                                                    onClick={() => navigator.clipboard.writeText(popularityAnalysis)}
                                                >
                                                    <Copy className="h-3 w-3 mr-1" /> コピー
                                                </Button>
                                            </div>

                                            {/* 分析結果表示 */}
                                            <div className="max-h-[calc(100vh-500px)] min-h-[300px] overflow-y-auto bg-white border border-slate-300 rounded-lg p-4">
                                                <div className="prose prose-sm max-w-none prose-headings:text-slate-900 prose-headings:font-bold prose-h1:text-xl prose-h2:text-lg prose-h2:text-orange-600 prose-h2:border-b prose-h2:border-orange-200 prose-h2:pb-1 prose-h3:text-base prose-p:text-slate-700 prose-p:leading-relaxed prose-li:text-slate-700 prose-strong:text-slate-900">
                                                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                                        {popularityAnalysis}
                                                    </ReactMarkdown>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </TabsContent>

                                <TabsContent value="copy" className="space-y-3 mt-4">
                                    {/* AIモデル選択 */}
                                    <div>
                                        <label className="text-slate-400 text-xs mb-1 block">🤖 AIモデル</label>
                                        <select
                                            className="w-full bg-slate-950 border border-emerald-700 rounded p-1.5 text-slate-200 text-xs font-medium"
                                            value={textModel}
                                            onChange={(e) => setTextModel(e.target.value)}
                                        >
                                            <option value="gemini-3-pro">🚀 Gemini 3 Pro（最新・最高品質）</option>
                                            <option value="gemini-2.5-flash">⚡ Gemini 2.5 Flash（高速・低コスト）</option>
                                            <option value="gpt-4o-mini">🔷 GPT-4o Mini（OpenAI・高速）</option>
                                        </select>
                                    </div>

                                    <Button
                                        onClick={handleGenerateCopy}
                                        disabled={generating}
                                        className="w-full h-10 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white border-0 rounded-lg font-bold text-sm shadow-md"
                                    >
                                        {generating ? (
                                            <>
                                                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> 生成中...
                                            </>
                                        ) : (
                                            <>
                                                <Sparkles className="mr-2 h-4 w-4" /> セールスコピーを生成
                                            </>
                                        )}
                                    </Button>

                                    {aiCopy && (
                                        <div className="space-y-2 p-3 bg-slate-800/50 rounded-lg border border-slate-700">
                                            <div className="flex items-center justify-between">
                                                <span className="text-sm font-bold text-white">📝 生成結果</span>
                                                <div className="flex gap-1">
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="h-7 px-3 text-xs text-emerald-400 hover:text-emerald-300 bg-emerald-500/10"
                                                        onClick={() => navigator.clipboard.writeText(aiCopy)}
                                                    >
                                                        <Copy className="h-3 w-3 mr-1" /> コピー
                                                    </Button>
                                                </div>
                                            </div>

                                            {/* フル表示の結果エリア */}
                                            <div className="max-h-[calc(100vh-400px)] min-h-[300px] overflow-y-auto bg-white border border-slate-300 rounded-lg p-4">
                                                <div className="prose prose-sm max-w-none prose-headings:text-slate-900 prose-headings:font-bold prose-h1:text-xl prose-h2:text-lg prose-h3:text-base prose-p:text-slate-700 prose-p:leading-relaxed prose-li:text-slate-700 prose-strong:text-slate-900">
                                                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                                        {aiCopy}
                                                    </ReactMarkdown>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </TabsContent>

                                <TabsContent value="image" className="mt-4">
                                    <ImageGenerator
                                        propertyUrl={property.url}
                                        propertyImages={images}
                                    />
                                </TabsContent>
                            </Tabs>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
