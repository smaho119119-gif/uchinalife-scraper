'use client';

import { useState } from 'react';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Loader2,
    ExternalLink,
    Download,
    RefreshCw,
    Database,
    FileText,
    Image as ImageIcon,
    X,
} from 'lucide-react';
import type { GeneratedImageItem } from '@/app/admin/types';

export interface LocalOnlyImage {
    filename: string;
    url: string;
    mode: string;
    style: string;
    created_at: string;
}

interface Props {
    images: GeneratedImageItem[];
    localOnly: LocalOnlyImage[];
    loading: boolean;
    onRefresh: () => void;
}

export function GeneratedImagesGallery({ images, localOnly, loading, onRefresh }: Props) {
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-slate-600">DB登録画像</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold text-pink-600">
                            {images.length}
                            <span className="text-lg text-slate-400">件</span>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-slate-600">ローカルのみ</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold text-amber-600">
                            {localOnly.length}
                            <span className="text-lg text-slate-400">件</span>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-slate-600">合計</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold text-emerald-600">
                            {images.length + localOnly.length}
                            <span className="text-lg text-slate-400">件</span>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle className="flex items-center gap-2">
                                <ImageIcon className="h-5 w-5" />
                                生成画像ギャラリー
                            </CardTitle>
                            <CardDescription>全ての生成バナー画像</CardDescription>
                        </div>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={onRefresh}
                            disabled={loading}
                            aria-label="生成画像を再取得"
                        >
                            {loading ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                <RefreshCw className="h-4 w-4" />
                            )}
                            更新
                        </Button>
                    </div>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="flex items-center justify-center py-12">
                            <Loader2 className="h-8 w-8 animate-spin text-pink-500" />
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {images.length > 0 && (
                                <Section
                                    title={`DB登録済み (${images.length}件)`}
                                    icon={<Database className="h-4 w-4" />}
                                    color="text-slate-600"
                                >
                                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                                        {images.map((img) => (
                                            <button
                                                type="button"
                                                key={img.id}
                                                className="group relative rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 hover:border-pink-400 transition-all cursor-pointer text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-pink-400"
                                                onClick={() => setPreviewUrl(img.image_url)}
                                                aria-label={`${img.filename} をプレビュー`}
                                            >
                                                <div className="aspect-video bg-slate-100 dark:bg-slate-800">
                                                    <img
                                                        src={img.image_url}
                                                        alt={img.filename}
                                                        className="w-full h-full object-cover"
                                                        onError={(e) => {
                                                            (e.target as HTMLImageElement).src =
                                                                '/placeholder.png';
                                                        }}
                                                    />
                                                </div>
                                                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                                                    <ExternalLink className="h-6 w-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                                                </div>
                                                <div className="p-2 bg-white dark:bg-slate-900">
                                                    <div className="flex gap-1 mb-1">
                                                        <Badge variant="secondary" className="text-[10px]">
                                                            {img.mode}
                                                        </Badge>
                                                        <Badge variant="outline" className="text-[10px]">
                                                            {img.style}
                                                        </Badge>
                                                    </div>
                                                    <p className="text-[10px] text-slate-500 truncate">
                                                        {img.property_url === 'unknown'
                                                            ? '未紐づけ'
                                                            : '物件紐づけ済'}
                                                    </p>
                                                    <p className="text-[10px] text-slate-400">
                                                        {new Date(img.created_at).toLocaleDateString('ja-JP')}
                                                    </p>
                                                </div>
                                                {!img.file_exists && (
                                                    <div className="absolute top-1 right-1 bg-red-500 text-white text-[8px] px-1 rounded">
                                                        ファイル無
                                                    </div>
                                                )}
                                            </button>
                                        ))}
                                    </div>
                                </Section>
                            )}

                            {localOnly.length > 0 && (
                                <Section
                                    title={`ローカルのみ (${localOnly.length}件)`}
                                    icon={<FileText className="h-4 w-4" />}
                                    color="text-amber-600"
                                >
                                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                                        {localOnly.map((img) => (
                                            <button
                                                type="button"
                                                key={img.filename}
                                                className="group relative rounded-lg overflow-hidden border border-amber-200 dark:border-amber-700 hover:border-amber-400 transition-all cursor-pointer text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
                                                onClick={() => setPreviewUrl(img.url)}
                                                aria-label={`${img.filename} をプレビュー`}
                                            >
                                                <div className="aspect-video bg-slate-100 dark:bg-slate-800">
                                                    <img
                                                        src={img.url}
                                                        alt={img.filename}
                                                        className="w-full h-full object-cover"
                                                    />
                                                </div>
                                                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                                                    <ExternalLink className="h-6 w-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                                                </div>
                                                <div className="p-2 bg-white dark:bg-slate-900">
                                                    <div className="flex gap-1 mb-1">
                                                        <Badge variant="secondary" className="text-[10px]">
                                                            {img.mode}
                                                        </Badge>
                                                        <Badge variant="outline" className="text-[10px]">
                                                            {img.style}
                                                        </Badge>
                                                    </div>
                                                    <p className="text-[10px] text-slate-400">
                                                        {new Date(img.created_at).toLocaleDateString('ja-JP')}
                                                    </p>
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                </Section>
                            )}

                            {images.length === 0 && localOnly.length === 0 && (
                                <div className="text-center py-12 text-slate-500">
                                    <ImageIcon className="h-12 w-12 mx-auto mb-3 opacity-50" />
                                    <p>生成画像がありません</p>
                                </div>
                            )}
                        </div>
                    )}
                </CardContent>
            </Card>

            {previewUrl && (
                <div
                    role="dialog"
                    aria-modal="true"
                    aria-label="画像プレビュー"
                    className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
                    onClick={() => setPreviewUrl(null)}
                    onKeyDown={(e) => {
                        if (e.key === 'Escape') setPreviewUrl(null);
                    }}
                    tabIndex={-1}
                >
                    <div className="relative max-w-4xl max-h-[90vh]">
                        <button
                            type="button"
                            className="absolute top-2 right-2 bg-white/10 hover:bg-white/20 rounded-full p-2 z-10 focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
                            onClick={() => setPreviewUrl(null)}
                            aria-label="プレビューを閉じる"
                        >
                            <X className="h-6 w-6 text-white" />
                        </button>
                        <img
                            src={previewUrl}
                            alt="生成画像のプレビュー"
                            className="max-w-full max-h-[90vh] object-contain rounded-lg"
                            onClick={(e) => e.stopPropagation()}
                        />
                        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
                            <a
                                href={previewUrl}
                                download
                                className="bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm flex items-center gap-2"
                                onClick={(e) => e.stopPropagation()}
                            >
                                <Download className="h-4 w-4" />
                                ダウンロード
                            </a>
                            <a
                                href={previewUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="bg-slate-600 hover:bg-slate-500 text-white px-4 py-2 rounded-lg text-sm flex items-center gap-2"
                                onClick={(e) => e.stopPropagation()}
                            >
                                <ExternalLink className="h-4 w-4" />
                                新しいタブ
                            </a>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function Section({
    title,
    icon,
    color,
    children,
}: {
    title: string;
    icon: React.ReactNode;
    color: string;
    children: React.ReactNode;
}) {
    return (
        <div>
            <h3 className={`text-sm font-semibold ${color} mb-3 flex items-center gap-2`}>
                {icon}
                {title}
            </h3>
            {children}
        </div>
    );
}
