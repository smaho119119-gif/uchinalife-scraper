import { NextRequest, NextResponse } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';
import { createClient } from '@supabase/supabase-js';
import { format, parseISO } from 'date-fns';
import { toZonedTime, fromZonedTime } from 'date-fns-tz';

const PROJECT_ROOT = '/Users/hiroki/Documents/うちなーらいふスクレイピング';
const LOGS_DIR = path.join(PROJECT_ROOT, 'logs');
const OUTPUT_DIR = path.join(PROJECT_ROOT, 'output');
const GITHUB_REPO = 'smaho119119-gif/uchinalife-scraper';
const GITHUB_WORKFLOW_FILE = 'property-scraper.yml';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_ANON_KEY!;

// キャッシュ（10分間有効）
let calendarCache: Map<string, { data: any; timestamp: number }> = new Map();
const CACHE_DURATION = 10 * 60 * 1000; // 10分

interface DayStats {
    date: string;
    hasLog: boolean;
    logFile: string | null;
    success: boolean;
    totalLinks: number;
    totalProcessed: number;
    categories: Record<string, number>;
    githubAction?: {
        runNumber: number;
        status: string;
        conclusion: string | null;
        htmlUrl: string;
        runStartedAt: string;
        updatedAt: string;
    };
    dataSources?: {
        supabase: {
            saved: boolean;
            count: number;
        };
        sqlite: {
            saved: boolean;
            fileExists: boolean;
        };
        csv: {
            saved: boolean;
            files: string[];
        };
    };
}

// GET: カレンダー情報を取得
export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const year = parseInt(searchParams.get('year') || new Date().getFullYear().toString());
    const month = parseInt(searchParams.get('month') || (new Date().getMonth() + 1).toString());
    const date = searchParams.get('date'); // YYYY-MM-DD形式

    try {
        if (date) {
            // 特定日の詳細を取得（キャッシュなし）
            return getDayDetails(date);
        } else {
            // キャッシュキーを生成
            const cacheKey = `${year}-${month}`;
            const cached = calendarCache.get(cacheKey);

            // キャッシュが有効な場合はキャッシュを返す
            if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
                console.log(`[Calendar API] Returning cached data for ${cacheKey}`);
                return NextResponse.json(cached.data);
            }

            // 月のカレンダーデータを取得
            const result = await getMonthCalendar(year, month);
            return result;
        }
    } catch (error) {
        console.error('Calendar API error:', error);
        return NextResponse.json({ error: 'Failed to get calendar data' }, { status: 500 });
    }
}

// GitHub Actionsの実行履歴を取得
async function fetchGitHubActionsRuns() {
    try {
        const url = `https://api.github.com/repos/${GITHUB_REPO}/actions/workflows/${GITHUB_WORKFLOW_FILE}/runs?per_page=100`;
        const response = await fetch(url);
        if (!response.ok) {
            console.error('Failed to fetch GitHub Actions runs:', response.statusText);
            return [];
        }
        const data = await response.json();
        return data.workflow_runs || [];
    } catch (error) {
        console.error('Error fetching GitHub Actions runs:', error);
        return [];
    }
}

// JSTタイムゾーン定数
const JST_TIMEZONE = 'Asia/Tokyo';

// JST日付をUTC時刻範囲に変換するヘルパー関数
function getJSTDateRange(dateStr: string): { startUTC: string; endUTC: string } {
    // 入力: "2025-12-10" (JST日付)
    // JSTの00:00:00をUTCに変換
    const jstMidnightStr = `${dateStr}T00:00:00`;
    const jstMidnight = fromZonedTime(parseISO(jstMidnightStr), JST_TIMEZONE);

    // JSTの23:59:59.999をUTCに変換
    const jstEndOfDayStr = `${dateStr}T23:59:59.999`;
    const jstEndOfDay = fromZonedTime(parseISO(jstEndOfDayStr), JST_TIMEZONE);

    return {
        startUTC: jstMidnight.toISOString(),
        endUTC: jstEndOfDay.toISOString(),
    };
}

// UTC時刻をJST日付文字列に変換するヘルパー関数
function utcToJSTDate(utcDateString: string): string {
    const utcDate = parseISO(utcDateString);
    const jstDate = toZonedTime(utcDate, JST_TIMEZONE);
    return format(jstDate, 'yyyy-MM-dd');
}

// Supabaseのデータ保存状況を確認（JST日付で）
async function checkSupabaseData(date: string): Promise<{ saved: boolean; count: number }> {
    try {
        if (!supabaseUrl || !supabaseKey) {
            return { saved: false, count: 0 };
        }

        const supabase = createClient(supabaseUrl, supabaseKey);
        // JST日付をUTC時刻範囲に変換（自動的にタイムゾーン差を調整）
        const { startUTC, endUTC } = getJSTDateRange(date);

        const { count, error } = await supabase
            .from('properties')
            .select('*', { count: 'exact', head: true })
            .gte('created_at', startUTC)
            .lte('created_at', endUTC);

        if (error) {
            console.error('Error checking Supabase data:', error);
            return { saved: false, count: 0 };
        }

        return { saved: (count || 0) > 0, count: count || 0 };
    } catch (error) {
        console.error('Error checking Supabase:', error);
        return { saved: false, count: 0 };
    }
}

// Supabaseのデータ保存状況を確認（特定の時刻範囲で）
async function checkSupabaseDataInRange(startUTC: string, endUTC: string): Promise<{ saved: boolean; count: number }> {
    try {
        if (!supabaseUrl || !supabaseKey) {
            return { saved: false, count: 0 };
        }

        const supabase = createClient(supabaseUrl, supabaseKey);

        const { count, error } = await supabase
            .from('properties')
            .select('*', { count: 'exact', head: true })
            .gte('created_at', startUTC)
            .lte('created_at', endUTC);

        if (error) {
            console.error('Error checking Supabase data in range:', error);
            return { saved: false, count: 0 };
        }

        return { saved: (count || 0) > 0, count: count || 0 };
    } catch (error) {
        console.error('Error checking Supabase in range:', error);
        return { saved: false, count: 0 };
    }
}

// SQLiteファイルの存在を確認
function checkSQLiteFile(date: string): { saved: boolean; fileExists: boolean } {
    try {
        const dbPath = path.join(OUTPUT_DIR, 'properties.db');
        const fileExists = fs.existsSync(dbPath);

        if (!fileExists) {
            return { saved: false, fileExists: false };
        }

        // SQLiteファイルの更新日時を確認（簡易的なチェック）
        const stats = fs.statSync(dbPath);
        const fileDate = new Date(stats.mtime).toISOString().split('T')[0];
        const saved = fileDate === date || fileDate >= date;

        return { saved, fileExists: true };
    } catch (error) {
        return { saved: false, fileExists: false };
    }
}

// CSVファイルの存在を確認
function checkCSVFiles(date: string): { saved: boolean; files: string[] } {
    try {
        const dateStr = date.replace(/-/g, '_');
        const files = fs.readdirSync(OUTPUT_DIR).filter(f =>
            f.endsWith('.csv') && f.includes(dateStr)
        );

        return { saved: files.length > 0, files };
    } catch (error) {
        return { saved: false, files: [] };
    }
}

// 月のカレンダーデータを取得
async function getMonthCalendar(year: number, month: number) {
    const daysInMonth = new Date(year, month, 0).getDate();
    const days: DayStats[] = [];

    // ログファイル一覧を取得
    let logFiles: string[] = [];
    let successMarkers: string[] = [];

    try {
        const files = fs.readdirSync(LOGS_DIR);
        logFiles = files.filter(f => /^(scraping|scheduled_scraping)_\d{8}_\d{6}\.log$/.test(f));
        successMarkers = files.filter(f => /^success_\d{8}\.marker$/.test(f));
    } catch {
        // ログディレクトリが存在しない
    }

    // GitHub Actionsの実行履歴を取得
    const githubRuns = await fetchGitHubActionsRuns();

    // GitHub Actionsの実行をJST日付でグループ化（UTC時刻をJSTに変換）
    const githubRunsByDate: Record<string, any[]> = {};
    githubRuns.forEach((run: any) => {
        // UTC時刻をJST日付に変換
        const jstDateStr = utcToJSTDate(run.run_started_at || run.created_at);
        const dateKey = jstDateStr.replace(/-/g, '');
        if (!githubRunsByDate[dateKey]) {
            githubRunsByDate[dateKey] = [];
        }
        githubRunsByDate[dateKey].push(run);
    });

    // === 最適化: 月全体のスナップショットを一度に取得 ===
    const monthStart = `${year}-${String(month).padStart(2, '0')}-01`;
    const monthEnd = `${year}-${String(month).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`;
    const snapshotsByDate: Record<string, { totalLinks: number; categories: Record<string, number> }> = {};

    try {
        if (supabaseUrl && supabaseKey) {
            const supabase = createClient(supabaseUrl, supabaseKey);
            const { data: snapshots } = await supabase
                .from('daily_link_snapshots')
                .select('snapshot_date, category, url_count')
                .gte('snapshot_date', monthStart)
                .lte('snapshot_date', monthEnd);

            // 日付ごとにグループ化
            if (snapshots) {
                snapshots.forEach((s: any) => {
                    const dateStr = s.snapshot_date;
                    if (!snapshotsByDate[dateStr]) {
                        snapshotsByDate[dateStr] = { totalLinks: 0, categories: {} };
                    }
                    if (s.url_count) {
                        snapshotsByDate[dateStr].totalLinks += s.url_count;
                        if (s.category) {
                            snapshotsByDate[dateStr].categories[s.category] = s.url_count;
                        }
                    }
                });
            }
        }
    } catch (error) {
        console.error('Error fetching monthly snapshots:', error);
    }

    for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const dateKey = `${year}${String(month).padStart(2, '0')}${String(day).padStart(2, '0')}`;

        // その日のログファイルを探す
        const dayLogs = logFiles.filter(f => f.includes(dateKey));
        const hasSuccess = successMarkers.some(f => f.includes(dateKey));

        // 最新のログファイルから統計を取得
        let totalLinks = 0;
        let totalProcessed = 0;
        const categories: Record<string, number> = {};

        if (dayLogs.length > 0) {
            const latestLog = dayLogs.sort().reverse()[0];
            const stats = parseLogFile(path.join(LOGS_DIR, latestLog));
            totalLinks = stats.totalLinks;
            totalProcessed = stats.totalProcessed;
            Object.assign(categories, stats.categories);
        }

        // === 最適化: キャッシュ済みスナップショットを使用 ===
        const snapshotData = snapshotsByDate[dateStr];
        if (snapshotData && snapshotData.totalLinks > 0) {
            totalLinks = snapshotData.totalLinks;
            Object.assign(categories, snapshotData.categories);
        }


        // GitHub Actionsの実行情報を取得
        const githubRunsForDay = githubRunsByDate[dateKey] || [];
        const latestGitHubRun = githubRunsForDay.length > 0
            ? githubRunsForDay.sort((a, b) =>
                new Date(b.run_started_at || b.created_at).getTime() -
                new Date(a.run_started_at || a.created_at).getTime()
            )[0]
            : null;

        // === 最適化: スナップショットデータがあれば保存済みと判断 ===
        // 複雑なSupabaseクエリを避け、事前取得したスナップショットを活用
        const supabaseData = snapshotData && snapshotData.totalLinks > 0
            ? { saved: true, count: snapshotData.totalLinks }
            : { saved: false, count: 0 };

        const sqliteData = checkSQLiteFile(dateStr);
        const csvData = checkCSVFiles(dateStr);

        days.push({
            date: dateStr,
            hasLog: dayLogs.length > 0 || latestGitHubRun !== null,
            logFile: dayLogs.length > 0 ? dayLogs.sort().reverse()[0] : null,
            success: hasSuccess || (latestGitHubRun?.conclusion === 'success'),
            totalLinks,
            totalProcessed,
            categories,
            githubAction: latestGitHubRun ? {
                runNumber: latestGitHubRun.run_number,
                status: latestGitHubRun.status,
                conclusion: latestGitHubRun.conclusion,
                htmlUrl: latestGitHubRun.html_url,
                runStartedAt: latestGitHubRun.run_started_at || latestGitHubRun.created_at,
                updatedAt: latestGitHubRun.updated_at,
            } : undefined,
            dataSources: {
                supabase: supabaseData,
                sqlite: sqliteData,
                csv: csvData,
            },
        });
    }

    const responseData = {
        year,
        month,
        days,
        summary: {
            totalDays: daysInMonth,
            daysWithLogs: days.filter((d: DayStats) => d.hasLog).length,
            successDays: days.filter((d: DayStats) => d.success).length,
            totalLinksCollected: days.reduce((sum: number, d: DayStats) => sum + d.totalLinks, 0),
        },
    };

    // キャッシュに保存
    const cacheKey = `${year}-${month}`;
    calendarCache.set(cacheKey, { data: responseData, timestamp: Date.now() });
    console.log(`[Calendar API] Cached data for ${cacheKey}`);

    return NextResponse.json(responseData);
}

// 特定日の詳細を取得
async function getDayDetails(date: string) {
    const dateKey = date.replace(/-/g, '');

    let logFiles: string[] = [];
    try {
        const files = fs.readdirSync(LOGS_DIR);
        logFiles = files.filter(f => f.includes(dateKey) && f.endsWith('.log'));
    } catch {
        return NextResponse.json({ date, logs: [], stats: null });
    }

    const logs = logFiles.map(file => {
        const filePath = path.join(LOGS_DIR, file);
        const stats = fs.statSync(filePath);
        const content = fs.readFileSync(filePath, 'utf-8');
        const lines = content.split('\n').filter(l => l.trim());

        return {
            filename: file,
            size: formatBytes(stats.size),
            createdAt: stats.birthtime.toISOString(),
            lineCount: lines.length,
            preview: lines.slice(-20).join('\n'),
            stats: parseLogFile(filePath),
        };
    });

    // データベースのスナップショットから正確なリンク数を取得（優先）
    let snapshotLinks = 0;
    const snapshotCategories: Record<string, number> = {};
    try {
        if (supabaseUrl && supabaseKey) {
            const supabase = createClient(supabaseUrl, supabaseKey);
            const snapshotResult = await supabase
                .from('daily_link_snapshots')
                .select('category, url_count')
                .eq('snapshot_date', date);

            if (snapshotResult.data && snapshotResult.data.length > 0) {
                snapshotLinks = snapshotResult.data.reduce((sum: number, s: any) => sum + (s.url_count || 0), 0);
                snapshotResult.data.forEach((s: any) => {
                    if (s.category && s.url_count) {
                        snapshotCategories[s.category] = s.url_count;
                    }
                });
            }
        }
    } catch (error) {
        console.error('Error fetching snapshot from database:', error);
    }

    // 成功マーカーを確認
    const successMarkerPath = path.join(LOGS_DIR, `success_${dateKey}.marker`);
    const hasSuccess = fs.existsSync(successMarkerPath);

    // GitHub Actionsの実行情報を取得
    const githubRuns = await fetchGitHubActionsRuns();
    // JST日付でGitHub Actionsの実行を検索（UTC時刻をJSTに変換）
    const githubRunForDay = githubRuns.find((run: any) => {
        const jstDateStr = utcToJSTDate(run.run_started_at || run.created_at);
        return jstDateStr === date;
    });

    // データソースの保存状況を確認
    // GitHub Actionsの実行がある場合、その実行時刻範囲でSupabaseデータを確認
    let supabaseData = { saved: false, count: 0 };
    let diagnosis: { issue: string; severity: 'error' | 'warning' | 'info'; message: string; solution: string }[] = [];

    if (githubRunForDay) {
        // GitHub Actionsの実行時刻範囲でSupabaseデータを確認
        const runStart = githubRunForDay.run_started_at || githubRunForDay.created_at;
        const runEnd = githubRunForDay.updated_at;
        supabaseData = await checkSupabaseDataInRange(runStart, runEnd);

        // GitHub Actions実行の診断
        if (githubRunForDay.conclusion === 'failure') {
            diagnosis.push({
                issue: 'GitHub Actions実行失敗',
                severity: 'error',
                message: `GitHub Actions #${githubRunForDay.run_number}が失敗しました`,
                solution: 'GitHub Actionsのログを確認してエラー原因を特定してください'
            });
        } else if (githubRunForDay.conclusion === 'success' && supabaseData.count === 0) {
            diagnosis.push({
                issue: 'Supabaseデータ未保存',
                severity: 'error',
                message: 'GitHub Actionsは成功しましたが、Supabaseにデータが保存されていません',
                solution: 'GitHub ActionsのログでSupabaseへの保存エラーを確認し、環境変数（SUPABASE_URL、SUPABASE_ANON_KEY）を確認してください'
            });
        }
    } else if (logs.length > 0) {
        // ローカル実行の場合、ログファイルの時刻範囲で確認
        const latestLog = logs[logs.length - 1];
        const logPath = path.join(LOGS_DIR, latestLog.filename);
        try {
            const stats = fs.statSync(logPath);
            const logStart = new Date(stats.birthtime.getTime() - 10 * 60 * 1000).toISOString();
            const logEnd = new Date(stats.mtime.getTime() + 10 * 60 * 1000).toISOString();
            supabaseData = await checkSupabaseDataInRange(logStart, logEnd);

            // ローカル実行の診断
            const totalProcessed = latestLog.stats.totalProcessed;
            if (totalProcessed > 0 && supabaseData.count < totalProcessed * 0.1) {
                const saveRate = (supabaseData.count / totalProcessed * 100).toFixed(1);
                diagnosis.push({
                    issue: 'Supabase未保存',
                    severity: 'error',
                    message: `スクレイピング件数: ${totalProcessed}件、Supabase保存件数: ${supabaseData.count}件（保存率: ${saveRate}%）`,
                    solution: '再スクレイピングを実行してSupabaseに保存してください'
                });
            }
        } catch (error) {
            supabaseData = await checkSupabaseData(date);
        }
    } else {
        supabaseData = await checkSupabaseData(date);
    }

    const sqliteData = checkSQLiteFile(date);
    const csvData = checkCSVFiles(date);

    // データソースの診断
    if (logs.length > 0 && !supabaseData.saved && supabaseData.count === 0) {
        diagnosis.push({
            issue: 'Supabaseデータ未保存',
            severity: 'error',
            message: 'スクレイピングは実行されましたが、Supabaseにデータが保存されていません',
            solution: '環境変数（SUPABASE_URL、SUPABASE_ANON_KEY）を確認し、再スクレイピングを実行してください'
        });
    }

    return NextResponse.json({
        date,
        hasSuccess: hasSuccess || (githubRunForDay?.conclusion === 'success'),
        logs,
        githubAction: githubRunForDay ? {
            runNumber: githubRunForDay.run_number,
            status: githubRunForDay.status,
            conclusion: githubRunForDay.conclusion,
            htmlUrl: githubRunForDay.html_url,
            runStartedAt: githubRunForDay.run_started_at || githubRunForDay.created_at,
            updatedAt: githubRunForDay.updated_at,
        } : undefined,
        dataSources: {
            supabase: supabaseData,
            sqlite: sqliteData,
            csv: csvData,
        },
        diagnosis,
        summary: logs.length > 0 ? {
            // データベースのスナップショットから取得したリンク数を優先
            totalLinks: snapshotLinks > 0 ? snapshotLinks : Math.max(...logs.map(l => l.stats.totalLinks)),
            totalProcessed: Math.max(...logs.map(l => l.stats.totalProcessed)),
            categories: Object.keys(snapshotCategories).length > 0 ? snapshotCategories : (logs[logs.length - 1]?.stats.categories || {}),
        } : snapshotLinks > 0 ? {
            totalLinks: snapshotLinks,
            totalProcessed: 0,
            categories: snapshotCategories,
        } : null,
    });
}

// ログファイルを解析して統計を取得
function parseLogFile(filePath: string): { totalLinks: number; totalProcessed: number; categories: Record<string, number> } {
    const categories: Record<string, number> = {};
    let totalLinks = 0;
    let totalProcessed = 0;

    try {
        const content = fs.readFileSync(filePath, 'utf-8');
        const lines = content.split('\n');

        // 直前の行からカテゴリ名を取得するための変数
        let lastCategoryName: string | null = null;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];

            // Processing Category: jukyo (住居) - カテゴリ名を記録
            const categoryMatch = line.match(/Processing Category: (\w+)/);
            if (categoryMatch) {
                lastCategoryName = categoryMatch[1];
            }

            // [house] Page 24: Collected 50 links. Total: 1200
            const linkMatch = line.match(/\[(\w+)\] Page \d+: Collected \d+ links\. Total: (\d+)/);
            if (linkMatch) {
                categories[linkMatch[1]] = parseInt(linkMatch[2]);
                lastCategoryName = linkMatch[1];
            }

            // [house] Collected total 4700 links
            const totalMatch = line.match(/\[(\w+)\] Collected total (\d+) links/);
            if (totalMatch) {
                categories[totalMatch[1]] = parseInt(totalMatch[2]);
                lastCategoryName = totalMatch[1];
            }

            // [jukyo] Loaded 3549 links (--skip-refresh使用時)
            const loadedMatch = line.match(/\[(\w+)\] Loaded (\d+) links/);
            if (loadedMatch) {
                categories[loadedMatch[1]] = parseInt(loadedMatch[2]);
                lastCategoryName = loadedMatch[1];
            }

            // Total URLs: 3549 (カテゴリ処理時の出力、直前の行からカテゴリ名を取得)
            const totalUrlsMatch = line.match(/Total URLs: (\d+)/);
            if (totalUrlsMatch && lastCategoryName) {
                const urlCount = parseInt(totalUrlsMatch[1]);
                categories[lastCategoryName] = urlCount;
            }

            // Progress: 50/552 (Success: 50, Errors: 0)
            const progressMatch = line.match(/Progress: (\d+)\/(\d+)/);
            if (progressMatch) {
                totalProcessed = parseInt(progressMatch[1]);
            }

            // Total scraped: 528
            const scrapedMatch = line.match(/Total scraped: (\d+)/);
            if (scrapedMatch) {
                totalProcessed = parseInt(scrapedMatch[1]);
            }

            // Scraped: 314 (カテゴリ別の完了メッセージ)
            const categoryScrapedMatch = line.match(/Scraped: (\d+)/);
            if (categoryScrapedMatch && line.includes('complete')) {
                // カテゴリ別のスクレイピング件数は合計に加算しない（最後のTotal scrapedを使用）
            }
        }

        totalLinks = Object.values(categories).reduce((sum, count) => sum + count, 0);
    } catch {
        // ファイル読み取りエラー
    }

    return { totalLinks, totalProcessed, categories };
}

function formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

