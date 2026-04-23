'use client';

import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import {
    Settings,
    Activity,
    Database,
    FileText,
    RefreshCw,
    Clock,
    Zap,
    AlertCircle,
} from 'lucide-react';
import type { ScrapingInfo } from '@/app/admin/types';

interface Props {
    scrapingInfo: ScrapingInfo | null;
}

export function ScrapingSettingsPanel({ scrapingInfo }: Props) {
    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Settings className="h-5 w-5" />
                        スクレイピング設定
                    </CardTitle>
                    <CardDescription>
                        現在のスクレイピング設定値（環境変数で変更可能）
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        <SettingTile icon={<Zap className="h-4 w-4 text-yellow-500" />} label="最大ワーカー数">
                            {scrapingInfo?.config.maxWorkers ?? 4}
                        </SettingTile>
                        <SettingTile icon={<Activity className="h-4 w-4 text-blue-500" />} label="最大RPS">
                            {scrapingInfo?.config.maxRequestsPerSecond ?? 5}
                        </SettingTile>
                        <SettingTile
                            icon={<Database className="h-4 w-4 text-green-500" />}
                            label="1ページあたりの件数"
                        >
                            {scrapingInfo?.config.itemsPerPage ?? 50}
                        </SettingTile>
                        <SettingTile
                            icon={<FileText className="h-4 w-4 text-purple-500" />}
                            label="カテゴリ最大ページ"
                        >
                            {scrapingInfo?.config.maxPagesPerCategory ?? 150}
                        </SettingTile>
                        <SettingTile
                            icon={<RefreshCw className="h-4 w-4 text-orange-500" />}
                            label="最大リトライ回数"
                        >
                            {scrapingInfo?.config.maxRetries ?? 3}
                        </SettingTile>
                        <SettingTile icon={<Clock className="h-4 w-4 text-red-500" />} label="タイムアウト">
                            {Math.floor((scrapingInfo?.schedule.timeout ?? 7200) / 3600)}時間
                        </SettingTile>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <AlertCircle className="h-5 w-5" />
                        環境変数で設定変更
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="bg-slate-900 text-slate-300 p-4 rounded-lg font-mono text-sm overflow-auto">
                        <pre>{`# .env ファイルで設定可能な変数
SCRAPER_MAX_WORKERS=4       # 並列ワーカー数
SCRAPER_ITEMS_PER_PAGE=50   # 1ページあたりの取得件数
SCRAPER_MAX_PAGES=150       # カテゴリ最大ページ数
SCRAPER_HEADLESS=true       # ヘッドレスモード
SCRAPER_MAX_RPS=5           # 最大リクエスト/秒
SCRAPER_MAX_RETRIES=3       # 最大リトライ回数
SCRAPER_RETRY_DELAY=2       # リトライ待機秒数`}</pre>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}

function SettingTile({
    icon,
    label,
    children,
}: {
    icon: React.ReactNode;
    label: string;
    children: React.ReactNode;
}) {
    return (
        <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
                {icon}
                <span className="text-sm text-slate-600 dark:text-slate-400">{label}</span>
            </div>
            <div className="text-2xl font-bold">{children}</div>
        </div>
    );
}
