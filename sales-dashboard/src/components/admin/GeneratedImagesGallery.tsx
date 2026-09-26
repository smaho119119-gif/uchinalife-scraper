'use client';

import { useState } from 'react';
import { EmptyState, Panel, SectionTitle, StatTile, StatusPill } from '@/components/admin/admin-ui';
import {
    Loader2,
    ExternalLink,
    Download,
    RefreshCw,
    Database,
    FileText,
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
        <div className="space-y-5">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <StatTile label="DB登録画像" value={<CountValue n={images.length} tone="text-teal-700" />} />
                <StatTile label="ローカルのみ" value={<CountValue n={localOnly.length} />} />
                <StatTile label="合計" value={<CountValue n={images.length + localOnly.length} />} />
            </div>

            <Panel>
                <div className="flex flex-wrap items-start justify-between gap-2">
                    <SectionTitle sub="全ての生成バナー画像">生成画像ギャラリー</SectionTitle>
                    <button
                        type="button"
                        onClick={onRefresh}
                        disabled={loading}
                        aria-label="生成画像を再取得"
                        className="inline-flex items-center gap-2 rounded-md border border-teal-700 bg-teal-700 px-3 py-1.5 text-[15px] font-semibold text-white hover:bg-teal-800 disabled:opacity-60"
                    >
                        {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <RefreshCw className="h-4 w-4" aria-hidden="true" />}
                        更新
                    </button>
                </div>
                <div>
                    {loading ? (
                        <div className="flex items-center justify-center py-12">
                            <Loader2 className="h-8 w-8 animate-spin text-teal-700" aria-label="読み込み中" />
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {images.length > 0 && (
                                <Section
                                    title={`DB登録済み (${images.length}件)`}
                                    icon={<Database className="h-4 w-4" />}
                                    color="text-slate-800"
                                >
                                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                                        {images.map((img) => (
                                            <button
                                                type="button"
                                                key={img.id}
                                                className="group relative rounded-lg overflow-hidden border border-slate-200 hover:border-teal-400 transition-all cursor-pointer text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-400"
                                                onClick={() => setPreviewUrl(img.image_url)}
                                                aria-label={`${img.filename} をプレビュー`}
                                            >
                                                <div className="aspect-video bg-slate-100">
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
                                                <div className="p-2 bg-white">
                                                    <div className="flex flex-wrap gap-1 mb-1 min-w-0">
                                                        <Tag tone="info">{img.mode}</Tag>
                                                        <Tag tone="muted">{img.style}</Tag>
                                                    </div>
                                                    <p className="text-[15px] text-slate-700 truncate">
                                                        {img.property_url === 'unknown'
                                                            ? '未紐づけ'
                                                            : '物件紐づけ済'}
                                                    </p>
                                                    <p className="text-[15px] text-slate-600">
                                                        {new Date(img.created_at).toLocaleDateString('ja-JP')}
                                                    </p>
                                                </div>
                                                {!img.file_exists && (
                                                    <div className="absolute top-1 right-1 rounded bg-red-700 px-1.5 text-[15px] font-semibold text-white">
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
                                    color="text-amber-800"
                                >
                                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                                        {localOnly.map((img) => (
                                            <button
                                                type="button"
                                                key={img.filename}
                                                className="group relative rounded-lg overflow-hidden border border-amber-200 hover:border-amber-400 transition-all cursor-pointer text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
                                                onClick={() => setPreviewUrl(img.url)}
                                                aria-label={`${img.filename} をプレビュー`}
                                            >
                                                <div className="aspect-video bg-slate-100">
                                                    <img
                                                        src={img.url}
                                                        alt={img.filename}
                                                        className="w-full h-full object-cover"
                                                    />
                                                </div>
                                                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                                                    <ExternalLink className="h-6 w-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                                                </div>
                                                <div className="p-2 bg-white">
                                                    <div className="flex flex-wrap gap-1 mb-1 min-w-0">
                                                        <Tag tone="info">{img.mode}</Tag>
                                                        <Tag tone="muted">{img.style}</Tag>
                                                    </div>
                                                    <p className="text-[15px] text-slate-600">
                                                        {new Date(img.created_at).toLocaleDateString('ja-JP')}
                                                    </p>
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                </Section>
                            )}

                            {images.length === 0 && localOnly.length === 0 && (
                                <EmptyState title="生成画像がありません" />
                            )}
                        </div>
                    )}
                </div>
            </Panel>

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
                                className="bg-teal-700 hover:bg-teal-800 text-white px-4 py-2 rounded-lg text-[15px] font-semibold flex items-center gap-2"
                                onClick={(e) => e.stopPropagation()}
                            >
                                <Download className="h-4 w-4" />
                                ダウンロード
                            </a>
                            <a
                                href={previewUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="bg-white hover:bg-teal-50 text-teal-800 border border-teal-700 px-4 py-2 rounded-lg text-[15px] font-semibold flex items-center gap-2"
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
            <h3 className={`text-[15px] font-bold ${color} mb-3 flex items-center gap-2`}>
                {icon}
                {title}
            </h3>
            {children}
        </div>
    );
}

/** 件数（数字＋「件」）。「件」も本文と同じ濃さで読めるようにする */
function CountValue({ n, tone = 'text-slate-900' }: { n: number; tone?: string }) {
    return (
        <span className={`text-3xl font-bold tabular-nums ${tone}`}>
            {n}
            <span className="ml-0.5 text-lg text-slate-600">件</span>
        </span>
    );
}

/** 画像の種類・スタイルの札（濃い文字に薄い背景。ほかのタブの札と同じ見た目） */
function Tag({ tone, children }: { tone: 'info' | 'muted'; children: React.ReactNode }) {
    return (
        <span className="max-w-full truncate">
            <StatusPill tone={tone}>{children}</StatusPill>
        </span>
    );
}
