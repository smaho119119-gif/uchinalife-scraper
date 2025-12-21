"use client";

import { Suspense } from 'react';
import InteractiveMap from '@/components/InteractiveMap';
import { Loader2 } from 'lucide-react';

export default function MapPage() {
    return (
        <Suspense fallback={
            <div className="h-[calc(100vh-120px)] flex items-center justify-center">
                <div className="text-center">
                    <Loader2 className="h-12 w-12 animate-spin text-cyan-500 mx-auto mb-4" />
                    <p className="text-slate-700 dark:text-slate-400 font-bold">マップを読み込み中...</p>
                </div>
            </div>
        }>
            <InteractiveMap fullPage />
        </Suspense>
    );
}
