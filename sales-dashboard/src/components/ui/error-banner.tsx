'use client';

import { AlertTriangle, RefreshCw } from 'lucide-react';

interface ErrorBannerProps {
    message: string;
    onRetry?: () => void;
}

/** Inline error UI used when a fetch fails. Replaces silent console.error patterns. */
export function ErrorBanner({ message, onRetry }: ErrorBannerProps) {
    return (
        <div
            role="alert"
            className="flex items-start gap-3 rounded-lg border border-red-500/50 bg-red-950/40 p-4 text-red-200"
        >
            <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0" />
            <div className="flex-1 min-w-0">
                <p className="font-medium">データの取得に失敗しました</p>
                <p className="mt-1 text-sm opacity-80 break-all">{message}</p>
            </div>
            {onRetry && (
                <button
                    type="button"
                    onClick={onRetry}
                    className="inline-flex items-center gap-1.5 rounded-md border border-red-500/50 bg-red-900/40 px-3 py-1.5 text-sm font-medium text-red-100 hover:bg-red-900/60 focus:outline-none focus:ring-2 focus:ring-red-400"
                >
                    <RefreshCw className="h-3.5 w-3.5" />
                    再試行
                </button>
            )}
        </div>
    );
}
