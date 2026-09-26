'use client';

import type { ReactNode } from 'react';
import { AlertTriangle, Inbox } from 'lucide-react';
import { cn } from '@/lib/utils';

/** 管理画面の見た目の共通部品と表示用の変換。色はティール1色＋状態色だけ使う */

export const CATEGORY_ORDER = ['jukyo', 'jigyo', 'yard', 'parking', 'tochi', 'mansion', 'house', 'sonota'] as const;

export const CATEGORY_LABEL: Record<string, string> = {
    jukyo: '賃貸・住居',
    jigyo: '賃貸・事業用',
    yard: '賃貸・月極駐車場',
    parking: '賃貸・時間貸駐車場',
    tochi: '売買・土地',
    mansion: '売買・マンション',
    house: '売買・戸建',
    sonota: '売買・その他',
};

export function catLabel(c: string): string {
    return CATEGORY_LABEL[c] ?? c;
}

/** グラフの色（検証済み: 新着=ティール / 売れた=オレンジ） */
export const CHART = {
    primary: '#0d9488',
    new: '#0d9488',
    sold: '#ea580c',
    grid: '#e2e8f0',
    axis: '#64748b',
};

export function fmtNum(n: number | null | undefined): string {
    if (n === null || n === undefined || Number.isNaN(n)) return '—';
    return n.toLocaleString('ja-JP');
}

const JST_DT = new Intl.DateTimeFormat('ja-JP', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
});
const JST_TIME = new Intl.DateTimeFormat('ja-JP', { timeZone: 'Asia/Tokyo', hour: '2-digit', minute: '2-digit' });

/** 時刻（ISO）を日本時間の「2026/9/26 06:35」に */
export function fmtJst(iso: string | null | undefined): string {
    if (!iso) return '—';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '—';
    return JST_DT.format(d);
}

export function fmtJstTime(iso: string | null | undefined): string {
    if (!iso) return '—';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '—';
    return JST_TIME.format(d);
}

/** 日付（YYYY-MM-DD）を「9/26(土)」に。日付そのものなのでタイムゾーンで動かさない */
export function fmtDay(ymd: string | null | undefined, withYear = false): string {
    if (!ymd) return '—';
    const [y, m, d] = ymd.split('-').map(Number);
    const wd = '日月火水木金土'[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
    return `${withYear ? `${y}/` : ''}${m}/${d}(${wd})`;
}

export function fmtBytes(b: number | null | undefined): string {
    if (b === null || b === undefined) return '—';
    if (b < 1024) return `${b} B`;
    const units = ['KB', 'MB', 'GB'];
    let v = b / 1024;
    let i = 0;
    while (v >= 1024 && i < units.length - 1) {
        v /= 1024;
        i++;
    }
    return `${v.toFixed(v < 10 ? 1 : 0)} ${units[i]}`;
}

export function fmtMinutes(min: number | null | undefined): string {
    if (min === null || min === undefined) return '—';
    const m = Math.round(Number(min));
    if (m < 60) return `${m}分`;
    return `${Math.floor(m / 60)}時間${m % 60}分`;
}

/** 日本時間の今日 */
export function jstTodayClient(): string {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tokyo' }).format(new Date());
}

/** 日付 a→b の日数差 */
export function dayDiff(a: string, b: string): number {
    return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000);
}

export function addDays(ymd: string, n: number): string {
    const t = Date.parse(`${ymd}T00:00:00Z`) + n * 86400000;
    return new Date(t).toISOString().slice(0, 10);
}

/** 9/24 より前は取り方が違う（住居が途中で切れていた）ので参考値 */
export const METHOD_CHANGE_DATE = '2026-09-24';

export function SectionTitle({ children, sub }: { children: ReactNode; sub?: ReactNode }) {
    return (
        <div className="mb-3">
            <h2 className="text-lg font-bold text-slate-900">{children}</h2>
            {sub && <p className="mt-1 text-[15px] text-slate-600">{sub}</p>}
        </div>
    );
}

/** 白い箱（カード） */
export function Panel({ children, className }: { children: ReactNode; className?: string }) {
    return (
        <section className={cn('rounded-xl border border-slate-200 bg-white p-4 text-slate-900 shadow-sm sm:p-5', className)}>
            {children}
        </section>
    );
}

export function StatTile({ label, value, note, tone }: { label: string; value: ReactNode; note?: ReactNode; tone?: 'ok' | 'warn' | 'bad' }) {
    return (
        <div className="rounded-xl border border-slate-200 bg-white p-4 text-slate-900 shadow-sm">
            <div className="text-[15px] font-medium text-slate-600">{label}</div>
            <div
                className={cn(
                    'mt-1 text-2xl font-bold tabular-nums',
                    tone === 'ok' && 'text-teal-700',
                    tone === 'warn' && 'text-amber-700',
                    tone === 'bad' && 'text-red-700',
                )}
            >
                {value}
            </div>
            {note && <div className="mt-1 text-[15px] text-slate-600">{note}</div>}
        </div>
    );
}

/** 表はスマホ幅で横スクロールの箱に入れる（ページ全体ははみ出さない） */
export function TableBox({ children, label }: { children: ReactNode; label: string }) {
    return (
        <div className="max-w-full overflow-x-auto rounded-lg border border-slate-200" role="region" aria-label={label} tabIndex={0}>
            {children}
        </div>
    );
}

export const TH = 'whitespace-nowrap bg-slate-50 px-3 py-2 text-left text-sm font-semibold text-slate-700';
export const THR = 'whitespace-nowrap bg-slate-50 px-3 py-2 text-right text-sm font-semibold text-slate-700';
export const TD = 'whitespace-nowrap px-3 py-2 text-[15px] text-slate-900';
export const TDR = 'whitespace-nowrap px-3 py-2 text-right text-[15px] tabular-nums text-slate-900';

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
    return (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center">
            <Inbox className="h-7 w-7 text-slate-400" aria-hidden="true" />
            <div className="text-[15px] font-semibold text-slate-800">{title}</div>
            {children && <div className="max-w-xl text-[15px] text-slate-600">{children}</div>}
        </div>
    );
}

export function ErrorNote({ children }: { children: ReactNode }) {
    return (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[15px] text-red-800" role="alert">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <div className="min-w-0 break-words">{children}</div>
        </div>
    );
}

export function StatusPill({ tone, children }: { tone: 'ok' | 'warn' | 'bad' | 'info' | 'muted'; children: ReactNode }) {
    return (
        <span
            className={cn(
                'inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-sm font-semibold',
                tone === 'ok' && 'border-teal-200 bg-teal-50 text-teal-800',
                tone === 'warn' && 'border-amber-200 bg-amber-50 text-amber-800',
                tone === 'bad' && 'border-red-200 bg-red-50 text-red-800',
                tone === 'info' && 'border-sky-200 bg-sky-50 text-sky-800',
                tone === 'muted' && 'border-slate-200 bg-slate-50 text-slate-700',
            )}
        >
            {children}
        </span>
    );
}

export function conclusionPill(conclusion: string | null | undefined) {
    switch (conclusion) {
        case 'success':
            return <StatusPill tone="ok">✓ 成功</StatusPill>;
        case 'failure':
            return <StatusPill tone="bad">✕ 失敗</StatusPill>;
        case 'cancelled':
            return <StatusPill tone="muted">中止</StatusPill>;
        case null:
        case undefined:
        case '':
            return <StatusPill tone="muted">不明</StatusPill>;
        default:
            return <StatusPill tone="warn">{conclusion}</StatusPill>;
    }
}

export function eventLabel(ev: string | null | undefined): string {
    if (ev === 'schedule') return '毎晩の自動';
    if (ev === 'workflow_dispatch') return '手動';
    if (ev === 'push') return '試運転（push）';
    return ev ?? '—';
}

export function modeLabel(mode: string | null | undefined): string {
    if (mode === 'full') return '本番';
    if (mode === 'collect-only') return '収集のみ';
    if (mode === 'mail-test') return 'メール試験';
    return mode ?? '—';
}

/** 予定時刻（その日の 03:17 日本時間）からの遅れ（分）。自動実行のときだけ */
export function scheduleDelayMinutes(snapshotDate: string | null, createdAt: string | null, event: string | null): number | null {
    if (event !== 'schedule' || !snapshotDate || !createdAt) return null;
    const planned = Date.parse(`${snapshotDate}T03:17:00+09:00`);
    const actual = Date.parse(createdAt);
    if (Number.isNaN(planned) || Number.isNaN(actual)) return null;
    return Math.round((actual - planned) / 60000);
}
