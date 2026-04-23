'use client';

import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FileText, RefreshCw, Terminal } from 'lucide-react';
import type { LogData, ScrapingInfo } from '@/app/admin/types';

interface Props {
    logData: LogData | null;
    selectedFile: string;
    scrapingInfo: ScrapingInfo | null;
    onSelectFile: (filename: string) => void;
    onRefresh: () => void;
}

export function LogViewerPanel({
    logData,
    selectedFile,
    scrapingInfo,
    onSelectFile,
    onRefresh,
}: Props) {
    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <CardTitle className="flex items-center gap-2">
                            <FileText className="h-5 w-5" />
                            ログファイル
                        </CardTitle>
                        <div className="flex gap-2">
                            <label htmlFor="logfile-select" className="sr-only">
                                ログファイルを選択
                            </label>
                            <select
                                id="logfile-select"
                                value={selectedFile}
                                onChange={(e) => onSelectFile(e.target.value)}
                                className="px-3 py-2 rounded-md border bg-white dark:bg-slate-800 text-sm"
                            >
                                {scrapingInfo?.logFiles.map((file) => (
                                    <option key={file.name} value={file.name}>
                                        {file.name} ({file.size})
                                    </option>
                                ))}
                            </select>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={onRefresh}
                                aria-label="ログを再読み込み"
                            >
                                <RefreshCw className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                    <CardDescription>
                        {logData?.totalLines
                            ? `全${logData.totalLines}行（最新100行を表示）`
                            : 'ログを選択してください'}
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="bg-slate-900 text-green-400 p-4 rounded-lg font-mono text-xs overflow-auto max-h-[500px]">
                        <pre className="whitespace-pre-wrap">
                            {logData?.logs ||
                                'ログを読み込むにはファイルを選択してリロードしてください'}
                        </pre>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Terminal className="h-5 w-5" />
                        ログファイル一覧
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="space-y-2">
                        {scrapingInfo?.logFiles.map((file) => {
                            const active = selectedFile === file.name;
                            return (
                                <button
                                    type="button"
                                    key={file.name}
                                    onClick={() => onSelectFile(file.name)}
                                    aria-pressed={active}
                                    className={`flex w-full items-center justify-between p-3 rounded-lg cursor-pointer transition-colors text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 ${
                                        active
                                            ? 'bg-cyan-50 dark:bg-cyan-900/20 border border-cyan-500'
                                            : 'bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700'
                                    }`}
                                >
                                    <div className="flex items-center gap-3">
                                        <FileText className="h-4 w-4 text-slate-500" />
                                        <span className="font-medium">{file.name}</span>
                                    </div>
                                    <div className="flex items-center gap-4 text-sm text-slate-500">
                                        <span>{file.size}</span>
                                        <span>{new Date(file.date).toLocaleString('ja-JP')}</span>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
