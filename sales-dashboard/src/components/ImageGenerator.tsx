"use client";

import { useState, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ImageIcon, Loader2, Copy, ExternalLink, Trash2, User } from 'lucide-react';

interface ImageGeneratorProps {
    propertyUrl: string;
    propertyImages: string[];
}

interface SavedStaffPhoto {
    id: string;
    name: string;
    dataUrl: string;
    timestamp: number;
}

export function ImageGenerator({ propertyUrl, propertyImages }: ImageGeneratorProps) {
    const fileInputRef = useRef<HTMLInputElement>(null); // ファイルinput参照
    const [generatingImage, setGeneratingImage] = useState(false);
    const [imageGallery, setImageGallery] = useState<Array<{ url: string, mode: string, style: string, timestamp: number }>>([]);
    const [imageMode, setImageMode] = useState('sns_banner');
    const [imageStyle, setImageStyle] = useState('modern');
    const [imageTemplate, setImageTemplate] = useState('standard');
    const [imageComposition, setImageComposition] = useState('center');
    const [imageSize, setImageSize] = useState('2K');
    const [imageAspectRatio, setImageAspectRatio] = useState('16:9');
    const [selectedPropertyImages, setSelectedPropertyImages] = useState<string[]>([]);
    const [staffPhoto, setStaffPhoto] = useState<string | null>(null);
    const [staffPhotoFile, setStaffPhotoFile] = useState<File | null>(null);
    const [savedStaffPhotos, setSavedStaffPhotos] = useState<SavedStaffPhoto[]>([]);
    const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null);
    const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null); // 削除確認用
    const [imageModel, setImageModel] = useState('gemini-3-pro'); // AIモデル選択
    const [generatingTime, setGeneratingTime] = useState(0); // 生成経過時間（秒）

    // データベースからスタッフ写真を読み込み
    useEffect(() => {
        const loadStaffPhotos = async () => {
            try {
                const res = await fetch('/api/staff-photos');
                const data = await res.json();
                
                if (data.photos && data.photos.length > 0) {
                    setSavedStaffPhotos(data.photos);
                }
                
                // 選択されていたスタッフを復元（localStorageから）
                const selectedId = localStorage.getItem('selectedStaffId');
                if (selectedId) {
                    setSelectedStaffId(selectedId);
                }
            } catch (e) {
                console.error('Failed to load staff photos:', e);
            }
        };
        
        loadStaffPhotos();
    }, []);

    // 選択されたスタッフIDが変わったら保存
    useEffect(() => {
        if (selectedStaffId) {
            localStorage.setItem('selectedStaffId', selectedStaffId);
            const photo = savedStaffPhotos.find(p => p.id === selectedStaffId);
            if (photo) {
                setStaffPhoto(photo.dataUrl);
            }
        } else {
            localStorage.removeItem('selectedStaffId');
            setStaffPhoto(null);
        }
    }, [selectedStaffId, savedStaffPhotos]);

    // Load generated images from database
    useEffect(() => {
        const loadGeneratedImages = async () => {
            try {
                const res = await fetch(`/api/ai/generated-images?url=${encodeURIComponent(propertyUrl)}`);
                const data = await res.json();

                if (data.images && Array.isArray(data.images)) {
                    setImageGallery(data.images);
                }
            } catch (e) {
                console.error('Failed to load generated images:', e);
            }
        };

        loadGeneratedImages();
    }, [propertyUrl]);

    const handleGenerateImage = async () => {
        if (selectedPropertyImages.length === 0) {
            alert("物件画像を最低1枚選択してください");
            return;
        }

        setGeneratingImage(true);
        setGeneratingTime(0);
        
        // 経過時間タイマー開始
        const timerInterval = setInterval(() => {
            setGeneratingTime(prev => prev + 1);
        }, 1000);
        
        try {
            const formData = new FormData();
            formData.append('url', propertyUrl);
            formData.append('mode', imageMode);
            formData.append('style', imageStyle);
            formData.append('template', imageTemplate);
            formData.append('composition', imageComposition);
            formData.append('size', imageSize);
            formData.append('aspectRatio', imageAspectRatio);
            formData.append('propertyImages', JSON.stringify(selectedPropertyImages));
            formData.append('model', imageModel); // AIモデル選択

            // スタッフ写真を送信（選択されている場合）- URLとして送信
            if (selectedStaffId) {
                const selectedPhoto = savedStaffPhotos.find(p => p.id === selectedStaffId);
                if (selectedPhoto) {
                    const photoUrl = selectedPhoto.dataUrl;
                    // ローカルURL(/staff-photos/...)またはhttpで始まるURLのみ送信
                    if (photoUrl.startsWith('/staff-photos/') || photoUrl.startsWith('http')) {
                        // ローカルURLの場合は絶対URLに変換
                        const fullUrl = photoUrl.startsWith('/') 
                            ? `${window.location.origin}${photoUrl}` 
                            : photoUrl;
                        formData.append('staffPhotoUrl', fullUrl);
                    } else if (photoUrl.startsWith('data:')) {
                        // まだbase64の場合（古いデータ）はスキップして警告
                        console.warn('Staff photo is still in base64 format. Please re-upload.');
                    }
                }
            }

            const res = await fetch('/api/ai/generate-image', {
                method: 'POST',
                body: formData,
            });
            const data = await res.json();

            if (data.imageUrl) {
                // 直接新しい画像をギャラリーに追加（即時反映）
                const newImage = {
                    url: data.imageUrl,
                    mode: imageMode,
                    style: imageStyle,
                    timestamp: Date.now()
                };
                setImageGallery(prev => {
                    const updated = [newImage, ...prev];
                    return updated;
                });
            } else if (data.error) {
                console.error('API Error:', data.error);
                alert(`画像生成エラー: ${data.error}`);
            } else {
                console.warn('No imageUrl in response:', data);
            }
        } catch (e) {
            console.error(e);
            alert("画像生成に失敗しました");
        } finally {
            clearInterval(timerInterval);
            setGeneratingImage(false);
            setGeneratingTime(0);
        }
    };

    const handleStaffPhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setStaffPhotoFile(file);
            const reader = new FileReader();
            reader.onloadend = async () => {
                const dataUrl = reader.result as string;
                
                // 新しいスタッフ写真をデータベースに保存
                const newPhoto: SavedStaffPhoto = {
                    id: `custom_${Date.now()}`,
                    name: `スタッフ${savedStaffPhotos.length + 1}`,
                    dataUrl,
                    timestamp: Date.now()
                };
                
                try {
                    const res = await fetch('/api/staff-photos', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            id: newPhoto.id,
                            name: newPhoto.name,
                            dataUrl: newPhoto.dataUrl
                        })
                    });
                    
                    if (res.ok) {
                        setSavedStaffPhotos(prev => [...prev, newPhoto]);
                        setSelectedStaffId(newPhoto.id);
                        setStaffPhoto(dataUrl);
                    } else {
                        console.error('Failed to save staff photo');
                    }
                } catch (error) {
                    console.error('Error saving staff photo:', error);
                }
            };
            reader.onerror = (error) => {
                console.error('FileReader error:', error);
            };
            reader.readAsDataURL(file);
        } else {
        }
        // inputをリセット（同じファイルを再度選択可能にする）
        e.target.value = '';
    };

    const togglePropertyImage = (imageUrl: string) => {
        setSelectedPropertyImages(prev =>
            prev.includes(imageUrl)
                ? prev.filter(url => url !== imageUrl)
                : [...prev, imageUrl]
        );
    };

    return (
        <div className="space-y-3">
            {/* AIモデル選択（フル幅） */}
            <div>
                <Label className="text-slate-400 text-xs mb-1 block">🤖 AIモデル</Label>
                <select
                    className="w-full bg-slate-950 border border-emerald-700 rounded p-1.5 text-slate-200 text-xs font-medium"
                    value={imageModel}
                    onChange={(e) => setImageModel(e.target.value)}
                >
                    <option value="gemini-3-pro">🚀 Gemini 3 Pro Image（最新・4K・日本語完全対応）</option>
                    <option value="gemini-2.5-flash">⚡ Gemini 2.5 Flash Image（高速・低コスト）</option>
                </select>
            </div>

            {/* 2列グリッドでセレクトボックスを配置 */}
            <div className="grid grid-cols-2 gap-2">
                {/* 生成モード */}
                <div>
                    <Label className="text-slate-400 text-xs mb-1 block">モード</Label>
                    <select
                        className="w-full bg-slate-950 border border-slate-700 rounded p-1.5 text-slate-200 text-xs"
                        value={imageMode}
                        onChange={(e) => setImageMode(e.target.value)}
                    >
                        <option value="sns_banner">📱 SNSバナー</option>
                        <option value="youtube_thumbnail">🎬 YouTube</option>
                        <option value="document">📄 紙資料</option>
                        <option value="infographic">📊 インフォグラフィック</option>
                        <option value="stories">📲 ストーリーズ</option>
                        <option value="instagram_post">📸 Instagram</option>
                    </select>
                </div>

                {/* 画風 */}
                <div>
                    <Label className="text-slate-400 text-xs mb-1 block">画風</Label>
                    <select
                        className="w-full bg-slate-950 border border-slate-700 rounded p-1.5 text-slate-200 text-xs"
                        value={imageStyle}
                        onChange={(e) => setImageStyle(e.target.value)}
                    >
                        <option value="modern">モダン</option>
                        <option value="luxury">高級感</option>
                        <option value="minimal">ミニマル</option>
                        <option value="natural">ナチュラル</option>
                        <option value="anime">アニメ風</option>
                        <option value="3d">3D</option>
                        <option value="business">📊 ビジネス資料</option>
                        <option value="neon">ネオン</option>
                        <option value="vintage">ヴィンテージ</option>
                    </select>
                </div>

                {/* テンプレート */}
                <div>
                    <Label className="text-slate-400 text-xs mb-1 block">テンプレート</Label>
                    <select
                        className="w-full bg-slate-950 border border-slate-700 rounded p-1.5 text-slate-200 text-xs"
                        value={imageTemplate}
                        onChange={(e) => setImageTemplate(e.target.value)}
                    >
                        <option value="standard">スタンダード</option>
                        <option value="collage">コラージュ</option>
                        <option value="magazine">雑誌風</option>
                        <option value="overlay">オーバーレイ</option>
                        <optgroup label="📊 紙資料・提案書">
                            <option value="proposal_card">📇 物件カード</option>
                            <option value="proposal_compare">📊 比較表付き</option>
                            <option value="proposal_flow">🔄 フロー型</option>
                            <option value="proposal_grid">🔲 グリッド型</option>
                        </optgroup>
                    </select>
                </div>

                {/* 構図 */}
                <div>
                    <Label className="text-slate-400 text-xs mb-1 block">構図</Label>
                    <select
                        className="w-full bg-slate-950 border border-slate-700 rounded p-1.5 text-slate-200 text-xs"
                        value={imageComposition}
                        onChange={(e) => setImageComposition(e.target.value)}
                    >
                        <option value="center">中央配置</option>
                        <option value="rule_of_thirds">三分割法</option>
                        <option value="symmetrical">シンメトリー</option>
                        <option value="asymmetrical">アシンメトリー</option>
                    </select>
                </div>

                {/* サイズ */}
                <div>
                    <Label className="text-slate-400 text-xs mb-1 block">サイズ</Label>
                    <select
                        className="w-full bg-slate-950 border border-slate-700 rounded p-1.5 text-slate-200 text-xs"
                        value={imageSize}
                        onChange={(e) => setImageSize(e.target.value)}
                    >
                        <option value="1K">1K</option>
                        <option value="2K">2K</option>
                        <option value="4K">4K</option>
                    </select>
                </div>

                {/* 比率 */}
                <div>
                    <Label className="text-slate-400 text-xs mb-1 block">比率</Label>
                    <select
                        className="w-full bg-slate-950 border border-slate-700 rounded p-1.5 text-slate-200 text-xs"
                        value={imageAspectRatio}
                        onChange={(e) => setImageAspectRatio(e.target.value)}
                    >
                        <option value="1:1">1:1</option>
                        <option value="16:9">16:9</option>
                        <option value="9:16">9:16</option>
                        <option value="4:3">4:3</option>
                    </select>
                </div>
            </div>

            {/* 物件画像選択（全表示） */}
            {propertyImages.length > 0 && (
                <div>
                    <div className="flex items-center justify-between mb-1">
                        <Label className="text-slate-400 text-xs">
                            画像選択 ({selectedPropertyImages.length}/{propertyImages.length})
                            <span className="text-red-400 ml-1">*</span>
                        </Label>
                        <div className="flex gap-2">
                            <button
                                type="button"
                                onClick={() => setSelectedPropertyImages([...propertyImages])}
                                className="text-xs text-emerald-500 hover:text-emerald-400"
                            >
                                全選択
                            </button>
                            <button
                                type="button"
                                onClick={() => setSelectedPropertyImages([])}
                                className="text-xs text-slate-400 hover:text-slate-300"
                            >
                                解除
                            </button>
                        </div>
                    </div>
                    <div className="grid grid-cols-4 gap-1 p-1 bg-slate-950 border border-slate-700 rounded">
                        {propertyImages.map((img: string, idx: number) => (
                            <div
                                key={idx}
                                className={`relative cursor-pointer rounded overflow-hidden border transition-all ${selectedPropertyImages.includes(img)
                                    ? 'border-emerald-500 ring-1 ring-emerald-500'
                                    : 'border-slate-700 hover:border-slate-500'
                                    }`}
                                onClick={() => togglePropertyImage(img)}
                            >
                                <img src={img} alt={`${idx + 1}`} className="w-full h-8 object-cover" />
                                {selectedPropertyImages.includes(img) && (
                                    <div className="absolute inset-0 bg-emerald-500/30 flex items-center justify-center">
                                        <span className="text-white text-[10px] font-bold">✓</span>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                    {selectedPropertyImages.length === 0 && (
                        <p className="text-xs text-red-400 mt-0.5">⚠️ 画像を選択
                        </p>
                    )}
                </div>
            )}

            {/* スタッフ写真（常に表示・選択式） */}
            <div className="relative">
                <div className="flex items-center justify-between mb-1">
                    <Label className="text-slate-400 text-xs">スタッフ ({savedStaffPhotos.length})</Label>
                    <input 
                        ref={fileInputRef}
                        type="file" 
                        accept="image/*" 
                        onChange={handleStaffPhotoUpload} 
                        style={{ display: 'none' }}
                    />
                    <button
                        type="button"
                        onClick={() => {
                            fileInputRef.current?.click();
                        }}
                        className="text-xs text-emerald-500 hover:text-emerald-400 cursor-pointer bg-transparent border-none"
                    >
                        + 追加
                    </button>
                </div>
                <div className="grid grid-cols-5 gap-1 p-1 bg-slate-950 border border-slate-700 rounded overflow-visible">
                    {/* 「なし」オプション */}
                    <div
                        className={`relative cursor-pointer rounded overflow-hidden border-2 transition-all ${
                            !selectedStaffId 
                                ? 'border-emerald-500 ring-1 ring-emerald-500' 
                                : 'border-slate-700 hover:border-slate-500'
                        }`}
                        onClick={() => setSelectedStaffId(null)}
                    >
                        <div className="w-full h-8 bg-slate-800 flex items-center justify-center">
                            <span className="text-slate-500 text-[10px]">なし</span>
                        </div>
                    </div>
                    
                    {/* スタッフ写真一覧 */}
                    {savedStaffPhotos.map((photo) => (
                        <div
                            key={photo.id}
                            className={`relative group cursor-pointer rounded border-2 transition-all ${
                                selectedStaffId === photo.id 
                                    ? 'border-emerald-500 ring-1 ring-emerald-500' 
                                    : 'border-slate-700 hover:border-slate-500'
                            }`}
                            onClick={() => setSelectedStaffId(photo.id)}
                        >
                            <img src={photo.dataUrl} alt={photo.name} className="w-full h-8 object-cover" />
                            {selectedStaffId === photo.id && (
                                <div className="absolute inset-0 bg-emerald-500/30 flex items-center justify-center">
                                    <span className="text-white text-[10px] font-bold">✓</span>
                                </div>
                            )}
                            {/* 削除ボタン */}
                            <button
                                type="button"
                                aria-label={`スタッフ写真「${photo.name}」を削除`}
                                className="absolute top-0 right-0 w-5 h-5 bg-red-600 hover:bg-red-500 text-white text-[11px] font-bold opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity rounded-bl focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setDeleteConfirmId(photo.id);
                                }}
                            >
                                ×
                            </button>

                            {/* 削除確認オーバーレイ */}
                            {deleteConfirmId === photo.id && (
                                <div
                                    role="alertdialog"
                                    aria-modal="true"
                                    aria-label="スタッフ写真の削除確認"
                                    className="absolute inset-0 bg-slate-900/95 rounded flex flex-col items-center justify-center p-1 gap-1"
                                    onClick={(e) => e.stopPropagation()}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Escape') {
                                            e.stopPropagation();
                                            setDeleteConfirmId(null);
                                        }
                                    }}
                                >
                                    <span className="text-[9px] text-slate-200 leading-tight text-center">削除しますか？</span>
                                    <div className="flex gap-1">
                                        <button
                                            type="button"
                                            aria-label="削除する"
                                            className="px-1.5 h-6 bg-red-600 hover:bg-red-500 text-white text-[10px] rounded font-bold focus:outline-none focus-visible:ring-2 focus-visible:ring-red-300"
                                            autoFocus
                                            onClick={async (e) => {
                                                e.stopPropagation();
                                                let ok = true;
                                                try {
                                                    const res = await fetch(`/api/staff-photos?id=${photo.id}`, { method: 'DELETE' });
                                                    if (!res.ok) ok = false;
                                                } catch (error) {
                                                    console.error('Failed to delete staff photo:', error);
                                                    ok = false;
                                                }
                                                if (ok) {
                                                    if (selectedStaffId === photo.id) setSelectedStaffId(null);
                                                    setSavedStaffPhotos((prev) => prev.filter((p) => p.id !== photo.id));
                                                    toast.success(`「${photo.name}」を削除しました`);
                                                } else {
                                                    toast.error('スタッフ写真の削除に失敗しました', {
                                                        description: 'しばらく待ってから再度お試しください。',
                                                    });
                                                }
                                                setDeleteConfirmId(null);
                                            }}
                                        >
                                            削除
                                        </button>
                                        <button
                                            type="button"
                                            aria-label="キャンセル"
                                            className="px-1.5 h-6 bg-slate-600 hover:bg-slate-500 text-white text-[10px] rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setDeleteConfirmId(null);
                                            }}
                                        >
                                            戻る
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
                {selectedStaffId && (
                    <p className="text-[10px] text-emerald-400 mt-0.5">✓ {savedStaffPhotos.find(p => p.id === selectedStaffId)?.name || 'スタッフ'}を使用</p>
                )}
            </div>

            {/* 生成ボタン */}
            <Button
                onClick={handleGenerateImage}
                disabled={generatingImage || selectedPropertyImages.length === 0}
                className="w-full h-9 bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-700 hover:to-cyan-700 text-white text-sm font-bold border-0 disabled:opacity-50"
            >
                {generatingImage ? (
                    <>
                        <Loader2 className="mr-1 h-3 w-3 animate-spin" /> 
                        生成中... {Math.floor(generatingTime / 60)}:{(generatingTime % 60).toString().padStart(2, '0')}
                    </>
                ) : (
                    <>
                        <ImageIcon className="mr-1 h-3 w-3" /> 画像を生成
                    </>
                )}
            </Button>
            
            {/* 生成中のヒント */}
            {generatingImage && (
                <p className="text-[10px] text-amber-400 text-center">
                    ⏳ Gemini 3 Proでの生成は数分かかる場合があります
                </p>
            )}

            {/* 生成履歴（コンパクト） */}
            {imageGallery.length > 0 && (
                <div className="space-y-1">
                    <p className="text-xs text-slate-400">生成履歴 ({imageGallery.length})</p>
                    <div className="grid grid-cols-2 gap-1 max-h-[100px] overflow-y-auto">
                        {imageGallery.slice(0, 4).map((item) => (
                            <div key={`${item.url}-${item.timestamp}`} className="relative group cursor-pointer rounded overflow-hidden border border-slate-700 hover:border-emerald-600" onClick={() => window.open(item.url, '_blank')}>
                                <img src={item.url} alt="Generated" className="w-full h-12 object-cover" />
                                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                    <ExternalLink className="h-4 w-4 text-white" />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
