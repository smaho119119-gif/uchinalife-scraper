// Next.js 自動ローディングUI - ページ遷移と同時に即座に表示される
export default function Loading() {
    return (
        <div className="min-h-screen bg-slate-950">
            {/* Hero Skeleton - 即座に表示 */}
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
}

