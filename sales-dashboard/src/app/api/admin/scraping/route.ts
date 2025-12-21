import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';

const execAsync = promisify(exec);

// プロジェクトのルートディレクトリ
const PROJECT_ROOT = '/Users/hiroki/Documents/うちなーらいふスクレイピング';
const LOGS_DIR = path.join(PROJECT_ROOT, 'logs');

// スクレイピング設定
const SCRAPING_CONFIG = {
    baseUrl: 'https://www.e-uchina.net',
    maxWorkers: parseInt(process.env.SCRAPER_MAX_WORKERS || '4'),
    itemsPerPage: parseInt(process.env.SCRAPER_ITEMS_PER_PAGE || '50'),
    maxPagesPerCategory: parseInt(process.env.SCRAPER_MAX_PAGES || '150'),
    headlessMode: process.env.SCRAPER_HEADLESS !== 'false',
    maxRequestsPerSecond: parseInt(process.env.SCRAPER_MAX_RPS || '5'),
    maxRetries: parseInt(process.env.SCRAPER_MAX_RETRIES || '3'),
    categories: [
        { id: 'jukyo', name: '賃貸 - 住居', url: '/jukyo' },
        { id: 'jigyo', name: '賃貸 - 事業用', url: '/jigyo' },
        { id: 'yard', name: '賃貸 - 月極駐車場', url: '/yard' },
        { id: 'parking', name: '賃貸 - 時間貸駐車場', url: '/parking' },
        { id: 'tochi', name: '売買 - 土地', url: '/tochi' },
        { id: 'mansion', name: '売買 - マンション', url: '/mansion' },
        { id: 'house', name: '売買 - 戸建', url: '/house' },
        { id: 'sonota', name: '売買 - その他', url: '/sonota' },
    ],
};

// スケジュール情報
const SCHEDULE_INFO = {
    daily: {
        enabled: true,
        time: '03:00',
        description: '毎日午前3時に自動実行',
    },
    timeout: 7200, // 2時間
};

// GET: スクレイピング情報を取得
export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'info';

    try {
        switch (type) {
            case 'info':
                return getScrapingInfo();
            case 'logs':
                return getScrapingLogs(searchParams.get('file'));
            case 'status':
                return getScrapingStatus();
            case 'progress':
                return getScrapingProgress();
            case 'schedule':
                return NextResponse.json(SCHEDULE_INFO);
            default:
                return NextResponse.json({ error: 'Unknown type' }, { status: 400 });
        }
    } catch (error) {
        console.error('Scraping API error:', error);
        return NextResponse.json(
            { error: 'Failed to get scraping info' },
            { status: 500 }
        );
    }
}

// POST: スクレイピングを実行
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { action, categories, noDiff, forceRefresh } = body;

        if (action === 'run') {
            // 再スクレイピング時は--no-diffオプションを使用（全件スクレイピング）
            // upsertで重複チェックが行われるため、既存データは更新され、新規データは追加される
            const options = {
                noDiff: noDiff !== false, // デフォルトでtrue（再スクレイピング時）
                forceRefresh: forceRefresh === true, // デフォルトでfalse
            };
            return runScraping(categories, options);
        } else if (action === 'stop') {
            return stopScraping();
        }

        return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    } catch (error) {
        console.error('Scraping execution error:', error);
        return NextResponse.json(
            { error: 'Failed to execute scraping' },
            { status: 500 }
        );
    }
}

// スクレイピング情報を取得
async function getScrapingInfo() {
    // ログファイル一覧を取得
    let logFiles: { name: string; date: string; size: string }[] = [];
    try {
        const files = fs.readdirSync(LOGS_DIR);
        logFiles = files
            .filter(f => f.endsWith('.log'))
            .map(f => {
                const stats = fs.statSync(path.join(LOGS_DIR, f));
                return {
                    name: f,
                    date: stats.mtime.toISOString(),
                    size: formatBytes(stats.size),
                };
            })
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    } catch {
        // ログディレクトリが存在しない場合
    }

    // 最後の成功マーカーを確認
    let lastSuccess: string | null = null;
    try {
        const files = fs.readdirSync(LOGS_DIR);
        const markers = files.filter(f => f.startsWith('success_') && f.endsWith('.marker'));
        if (markers.length > 0) {
            const latestMarker = markers.sort().reverse()[0];
            const dateMatch = latestMarker.match(/success_(\d{8})\.marker/);
            if (dateMatch) {
                lastSuccess = dateMatch[1].replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3');
            }
        }
    } catch {
        // エラー時はnull
    }

    // チェックポイントファイルを確認
    let checkpoint = null;
    try {
        const checkpointPath = path.join(PROJECT_ROOT, 'output', 'checkpoint.json');
        if (fs.existsSync(checkpointPath)) {
            const data = JSON.parse(fs.readFileSync(checkpointPath, 'utf-8'));
            checkpoint = data;
        }
    } catch {
        // チェックポイントなし
    }

    return NextResponse.json({
        config: SCRAPING_CONFIG,
        schedule: SCHEDULE_INFO,
        logFiles,
        lastSuccess,
        checkpoint,
    });
}

// スクレイピングログを取得
async function getScrapingLogs(filename: string | null) {
    const logFile = filename || 'scraper.log';
    const logPath = path.join(LOGS_DIR, logFile);

    try {
        if (!fs.existsSync(logPath)) {
            return NextResponse.json({ logs: 'ログファイルが見つかりません' });
        }

        // 最後の100行を取得
        const content = fs.readFileSync(logPath, 'utf-8');
        const lines = content.split('\n');
        const lastLines = lines.slice(-100).join('\n');

        return NextResponse.json({
            filename: logFile,
            logs: lastLines,
            totalLines: lines.length,
        });
    } catch (error) {
        return NextResponse.json(
            { error: 'Failed to read log file' },
            { status: 500 }
        );
    }
}

// スクレイピング状態を取得
async function getScrapingStatus() {
    try {
        // Pythonプロセスが実行中か確認
        const { stdout } = await execAsync('pgrep -f "integrated_scraper.py" || echo ""');
        const isRunning = stdout.trim().length > 0;

        // 実行中の場合、PIDを取得
        const pids = stdout.trim().split('\n').filter(p => p);

        return NextResponse.json({
            isRunning,
            pids,
            message: isRunning ? 'スクレイピング実行中' : 'スクレイピング停止中',
        });
    } catch {
        return NextResponse.json({
            isRunning: false,
            pids: [],
            message: 'ステータス取得エラー',
        });
    }
}

// スクレイピング進捗を取得
async function getScrapingProgress() {
    try {
        // 最新のログファイルから現在の処理状況を取得
        let currentLog = '';
        let startTime: string | null = null;
        let phase = 'unknown'; // 'collecting' | 'scraping' | 'completed'
        let currentCategory = '';
        let currentPage = 0;
        let processedItems = 0;
        let totalItems = 0;
        const categoryStats: Record<string, { links: number; processed: number; total: number }> = {};

        try {
            const files = fs.readdirSync(LOGS_DIR);
            
            // ファイル名から日時を抽出してソート（scraping_YYYYMMDD_HHMMSS.log または scheduled_scraping_YYYYMMDD_HHMMSS.log形式）
            const logFiles = files
                .filter(f => /^(scraping|scheduled_scraping)_\d{8}_\d{6}\.log$/.test(f))
                .map(f => {
                    const match = f.match(/(?:scraping|scheduled_scraping)_(\d{8})_(\d{6})\.log/);
                    return {
                        name: f,
                        dateTime: match ? match[1] + match[2] : '0',
                        size: fs.statSync(path.join(LOGS_DIR, f)).size,
                    };
                })
                .filter(f => f.size > 0) // 空ファイルを除外
                .sort((a, b) => b.dateTime.localeCompare(a.dateTime)); // 日時で降順ソート
            
            if (logFiles.length > 0) {
                const latestLogPath = path.join(LOGS_DIR, logFiles[0].name);
                const logContent = fs.readFileSync(latestLogPath, 'utf-8');
                const lines = logContent.split('\n').filter(l => l.trim());
                
                // 最後の15行を取得
                currentLog = lines.slice(-15).join('\n');
                
                // 開始時刻を取得（ファイル名から）
                const fileNameMatch = logFiles[0].name.match(/(?:scraping|scheduled_scraping)_(\d{8})_(\d{6})\.log/);
                if (fileNameMatch) {
                    const dateStr = fileNameMatch[1];
                    const timeStr = fileNameMatch[2];
                    startTime = `${dateStr.slice(0,4)}-${dateStr.slice(4,6)}-${dateStr.slice(6,8)} ${timeStr.slice(0,2)}:${timeStr.slice(2,4)}:${timeStr.slice(4,6)}`;
                }

                // 全ログを解析して各カテゴリの最新状態を取得
                for (const line of lines) {
                    // リンク収集フェーズの検出
                    // [house] Page 24: Collected 50 links. Total: 1200
                    const linkMatch = line.match(/\[(\w+)\] Page (\d+): Collected \d+ links\. Total: (\d+)/);
                    if (linkMatch) {
                        const cat = linkMatch[1];
                        const page = parseInt(linkMatch[2]);
                        const total = parseInt(linkMatch[3]);
                        
                        if (!categoryStats[cat]) {
                            categoryStats[cat] = { links: 0, processed: 0, total: 0 };
                        }
                        categoryStats[cat].links = total;
                        
                        // 最新のカテゴリとページを更新
                        phase = 'collecting';
                        currentCategory = cat;
                        currentPage = page;
                    }

                    // カテゴリ完了の検出
                    // [house] Collected total 4700 links
                    const catCompleteMatch = line.match(/\[(\w+)\] Collected total (\d+) links/);
                    if (catCompleteMatch) {
                        const cat = catCompleteMatch[1];
                        const total = parseInt(catCompleteMatch[2]);
                        if (!categoryStats[cat]) {
                            categoryStats[cat] = { links: 0, processed: 0, total: 0 };
                        }
                        categoryStats[cat].links = total;
                    }

                    // データ取得フェーズの検出
                    // [house] Processing 1/1200: https://...
                    // または [house] 1/1200 完了
                    const processMatch = line.match(/\[(\w+)\] (?:Processing )?(\d+)\/(\d+)/);
                    if (processMatch) {
                        const cat = processMatch[1];
                        const processed = parseInt(processMatch[2]);
                        const total = parseInt(processMatch[3]);
                        
                        phase = 'scraping';
                        currentCategory = cat;
                        processedItems = processed;
                        totalItems = total;
                        
                        if (!categoryStats[cat]) {
                            categoryStats[cat] = { links: 0, processed: 0, total: 0 };
                        }
                        categoryStats[cat].processed = processed;
                        categoryStats[cat].total = total;
                    }

                    // 完了検出（英語と日本語の両方に対応）
                    if (line.includes('Scraping completed') || 
                        line.includes('All categories completed') || 
                        line.includes('SCRAPING COMPLETE') ||
                        line.includes('スクレイピングが完了しました') ||
                        line.includes('スクレイピング完了')) {
                        phase = 'completed';
                        currentCategory = ''; // 完了時はcurrentCategoryをリセット
                    }
                }
            }
        } catch (err) {
            console.error('Log read error:', err);
        }

        // 合計リンク数を計算
        const collectedLinks = Object.values(categoryStats).reduce((sum, cat) => sum + cat.links, 0);
        const totalProcessed = Object.values(categoryStats).reduce((sum, cat) => sum + cat.processed, 0);

        // チェックポイントファイルから既存の進捗も取得（スクレイピング中は破損の可能性があるためスキップ）
        let checkpointProcessed = 0;
        // スクレイピング実行中はチェックポイント読み取りをスキップ（書き込み中で不完全な可能性があるため）
        // 代わりにログからの進捗のみを使用

        // カテゴリ別進捗を生成
        const categoryProgress = SCRAPING_CONFIG.categories.map(cat => ({
            id: cat.id,
            name: cat.name,
            links: categoryStats[cat.id]?.links || 0,
            processed: categoryStats[cat.id]?.processed || 0,
            total: categoryStats[cat.id]?.total || 0,
        }));

        // スクレイピングが完了している場合、currentCategoryをリセット
        if (phase === 'completed') {
            currentCategory = '';
        }

        return NextResponse.json({
            phase,
            currentCategory,
            currentPage,
            collectedLinks,
            processedItems,
            totalItems,
            totalProcessed,
            checkpointProcessed,
            categoryProgress,
            currentLog,
            startTime,
        });
    } catch (error) {
        console.error('Progress fetch error:', error);
        return NextResponse.json({
            phase: 'unknown',
            currentCategory: '',
            currentPage: 0,
            collectedLinks: 0,
            processedItems: 0,
            totalItems: 0,
            totalProcessed: 0,
            checkpointProcessed: 0,
            categoryProgress: [],
            currentLog: '',
            startTime: null,
            error: 'Failed to fetch progress',
        });
    }
}

// スクレイピングを実行
async function runScraping(categories?: string[], options?: { noDiff?: boolean; forceRefresh?: boolean }) {
    // すでに実行中か確認
    const statusRes = await getScrapingStatus();
    const status = await statusRes.json();
    
    if (status.isRunning) {
        return NextResponse.json(
            { error: 'スクレイピングは既に実行中です', pids: status.pids },
            { status: 409 }
        );
    }

    // オプションを構築
    const optionFlags: string[] = [];
    if (options?.noDiff) {
        optionFlags.push('--no-diff');
    }
    if (options?.forceRefresh) {
        optionFlags.push('--force-refresh');
    }

    // バックグラウンドでスクレイピングを開始
    const baseCommand = categories?.length
        ? `cd "${PROJECT_ROOT}" && /Users/hiroki/miniconda3/bin/python3 integrated_scraper.py --categories ${categories.join(' ')}`
        : `cd "${PROJECT_ROOT}" && /Users/hiroki/miniconda3/bin/python3 integrated_scraper.py`;
    
    const command = optionFlags.length > 0
        ? `${baseCommand} ${optionFlags.join(' ')}`
        : baseCommand;

    // 非同期で実行（結果を待たない）
    exec(`${command} > "${LOGS_DIR}/scraping_$(date +%Y%m%d_%H%M%S).log" 2>&1 &`, (error) => {
        if (error) {
            console.error('Scraping start error:', error);
        }
    });

    return NextResponse.json({
        success: true,
        message: 'スクレイピングを開始しました',
        command,
    });
}

// スクレイピングを停止
async function stopScraping() {
    try {
        await execAsync('pkill -f "integrated_scraper.py"');
        return NextResponse.json({
            success: true,
            message: 'スクレイピングを停止しました',
        });
    } catch {
        return NextResponse.json({
            success: true,
            message: 'スクレイピングプロセスが見つかりませんでした',
        });
    }
}

// バイトを読みやすい形式に変換
function formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

