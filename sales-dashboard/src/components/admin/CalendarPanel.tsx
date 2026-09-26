'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Loader2, X } from 'lucide-react';
import type { CalendarDay, CalendarResponse, DayDetailResponse } from '@/app/admin/types';
import {
    CATEGORY_ORDER,
    catLabel,
    conclusionPill,
    EmptyState,
    ErrorNote,
    eventLabel,
    fmtDay,
    fmtJst,
    fmtNum,
    jstTodayClient,
    METHOD_CHANGE_DATE,
    modeLabel,
    Panel,
    SectionTitle,
    StatTile,
    TableBox,
    TD,
    TDR,
    TH,
    THR,
} from '@/components/admin/admin-ui';
import { RunDetail } from '@/components/admin/RunsPanel';
import { cn } from '@/lib/utils';

type DayState = 'future' | 'ok' | 'fail' | 'snapshot' | 'missing' | 'partial';

function dayState(d: CalendarDay): DayState {
    if (d.isFuture) return 'future';
    const full = d.runs.filter((r) => r.mode === 'full' || r.mode === null);
    if (full.some((r) => r.conclusion === 'success')) return d.snapshotCategories > 0 && d.snapshotCategories < 8 ? 'partial' : 'ok';
    if (full.length > 0) return 'fail';
    if (d.snapshotCategories >= 8) return 'snapshot';
    if (d.snapshotCategories > 0) return 'partial';
    return 'missing';
}

const STATE_STYLE: Record<DayState, string> = {
    future: 'border-slate-200 bg-slate-50 text-slate-400',
    ok: 'border-teal-300 bg-teal-50 text-slate-900',
    fail: 'border-red-300 bg-red-50 text-slate-900',
    snapshot: 'border-slate-200 bg-white text-slate-900',
    partial: 'border-amber-300 bg-amber-50 text-slate-900',
    missing: 'border-amber-400 bg-amber-100 text-slate-900',
};

const STATE_MARK: Record<DayState, string> = {
    future: '',
    ok: '✓',
    fail: '✕',
    snapshot: '●',
    partial: '△',
    missing: '抜',
};

const STATE_LABEL: Record<DayState, string> = {
    future: 'これから',
    ok: '取得成功（実行の記録あり）',
    fail: '実行したが失敗',
    snapshot: '掲載件数の記録のみ（9/24 以前の旧方式など）',
    partial: '8種類そろっていない',
    missing: '取得が抜けた日（記録なし）',
};

function compact(n: number | null): string {
    if (n === null) return '—';
    if (n >= 10000) return `${(n / 10000).toFixed(1)}万`;
    return n.toLocaleString('ja-JP');
}

export function CalendarPanel() {
    const today = jstTodayClient();
    const [ym, setYm] = useState(() => today.slice(0, 7));
    const [month, setMonth] = useState<CalendarResponse | null>(null);
    const [monthError, setMonthError] = useState<string | null>(null);
    const [loadingMonth, setLoadingMonth] = useState(false);
    const [selected, setSelected] = useState<string | null>(null);
    const [detail, setDetail] = useState<DayDetailResponse | null>(null);
    const [detailError, setDetailError] = useState<string | null>(null);
    const [loadingDetail, setLoadingDetail] = useState(false);
    const detailRef = useRef<HTMLDivElement | null>(null);

    const loadMonth = useCallback(async (target: string) => {
        setLoadingMonth(true);
        setMonthError(null);
        try {
            const res = await fetch(`/api/admin/calendar?month=${target}`, { cache: 'no-store' });
            const body = await res.json();
            if (!res.ok) throw new Error(body?.error ?? `HTTP ${res.status}`);
            setMonth(body as CalendarResponse);
        } catch (e) {
            setMonthError(e instanceof Error ? e.message : String(e));
        } finally {
            setLoadingMonth(false);
        }
    }, []);

    useEffect(() => {
        loadMonth(ym);
    }, [ym, loadMonth]);

    const openDay = async (date: string) => {
        setSelected(date);
        setDetail(null);
        setDetailError(null);
        setLoadingDetail(true);
        requestAnimationFrame(() => detailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
        try {
            const res = await fetch(`/api/admin/calendar?date=${date}`, { cache: 'no-store' });
            const body = await res.json();
            if (!res.ok) throw new Error(body?.error ?? `HTTP ${res.status}`);
            setDetail(body as DayDetailResponse);
        } catch (e) {
            setDetailError(e instanceof Error ? e.message : String(e));
        } finally {
            setLoadingDetail(false);
        }
    };

    const shiftMonth = (delta: number) => {
        const [y, m] = ym.split('-').map(Number);
        const d = new Date(Date.UTC(y, m - 1 + delta, 1));
        setYm(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`);
        setSelected(null);
        setDetail(null);
    };

    const [y, m] = ym.split('-').map(Number);
    const firstWeekday = new Date(Date.UTC(y, m - 1, 1)).getUTCDay();
    const days = month && month.year === y && month.month === m ? month.days : [];
    const past = days.filter((d) => !d.isFuture);
    const states = past.map(dayState);
    const runsInMonth = days.reduce((s, d) => s + d.runs.length, 0);
    const okRuns = days.reduce((s, d) => s + d.runs.filter((r) => r.conclusion === 'success').length, 0);

    return (
        <div className="space-y-5">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <StatTile label="実行（この月）" value={`${runsInMonth}回`} note={`うち成功 ${okRuns}回`} />
                <StatTile label="掲載件数の記録がある日" value={`${past.filter((d) => d.snapshotCategories > 0).length}/${past.length}日`} />
                <StatTile
                    label="取得が抜けた日"
                    value={`${states.filter((s) => s === 'missing').length}日`}
                    tone={states.some((s) => s === 'missing') ? 'warn' : 'ok'}
                    note={`8種類そろわない日 ${states.filter((s) => s === 'partial').length}日`}
                />
                <StatTile
                    label="新着 / 売れた（合計）"
                    value={
                        <span className="text-xl">
                            {fmtNum(days.reduce((s, d) => s + d.newCount, 0))} / {fmtNum(days.reduce((s, d) => s + d.soldCount, 0))}
                        </span>
                    }
                />
            </div>

            <Panel>
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <h2 className="text-lg font-bold text-slate-900">取得カレンダー（日本時間）</h2>
                    <div className="flex items-center gap-2">
                        <button type="button" onClick={() => shiftMonth(-1)} className="rounded-md border border-slate-300 p-2 hover:border-teal-500" aria-label="前の月">
                            <ChevronLeft className="h-5 w-5" />
                        </button>
                        <span className="min-w-[7.5em] text-center text-lg font-bold tabular-nums" aria-live="polite">
                            {y}年{m}月
                        </span>
                        <button type="button" onClick={() => shiftMonth(1)} className="rounded-md border border-slate-300 p-2 hover:border-teal-500" aria-label="次の月">
                            <ChevronRight className="h-5 w-5" />
                        </button>
                        {loadingMonth && <Loader2 className="h-5 w-5 animate-spin text-teal-700" aria-label="読み込み中" />}
                    </div>
                </div>
                {monthError && <ErrorNote>カレンダーを読み込めませんでした（{monthError}）</ErrorNote>}
                {month?.dailyError && <ErrorNote>掲載件数・新着・売れたを読み込めませんでした（{month.dailyError}）</ErrorNote>}
                {month?.runsError && <ErrorNote>実行の記録を読み込めませんでした（{month.runsError}）</ErrorNote>}

                <div className="grid grid-cols-7 gap-1 text-center text-sm font-semibold">
                    {['日', '月', '火', '水', '木', '金', '土'].map((w, i) => (
                        <div key={w} className={cn('py-1', i === 0 ? 'text-red-700' : i === 6 ? 'text-sky-700' : 'text-slate-700')}>
                            {w}
                        </div>
                    ))}
                </div>
                <div className="grid grid-cols-7 gap-1" data-testid="calendar-grid">
                    {Array.from({ length: firstWeekday }).map((_, i) => (
                        <div key={`blank-${i}`} />
                    ))}
                    {days.map((d) => {
                        const st = dayState(d);
                        const dayNum = Number(d.date.slice(8));
                        return (
                            <button
                                key={d.date}
                                type="button"
                                disabled={d.isFuture}
                                onClick={() => openDay(d.date)}
                                data-date={d.date}
                                aria-label={`${fmtDay(d.date, true)} ${STATE_LABEL[st]}`}
                                className={cn(
                                    'flex min-h-16 min-w-0 flex-col items-start rounded-md border p-1 text-left lg:min-h-24 lg:p-2',
                                    STATE_STYLE[st],
                                    d.date === today && 'ring-2 ring-teal-700',
                                    selected === d.date && 'outline outline-2 outline-offset-1 outline-slate-900',
                                    !d.isFuture && 'hover:shadow-md',
                                )}
                            >
                                <span className="flex w-full items-center justify-between text-[15px] font-bold tabular-nums">
                                    {dayNum}
                                    <span aria-hidden="true" className={cn('text-sm', st === 'fail' && 'text-red-700', st === 'ok' && 'text-teal-700', (st === 'missing' || st === 'partial') && 'text-amber-800')}>
                                        {STATE_MARK[st]}
                                    </span>
                                </span>
                                {!d.isFuture && (
                                    <span className="mt-auto hidden w-full space-y-0.5 text-[13px] leading-tight tabular-nums text-slate-700 lg:block">
                                        <span className="block truncate">掲載 {compact(d.listings)}</span>
                                        <span className="block truncate">
                                            新{fmtNum(d.newCount)}・売{fmtNum(d.soldCount)}
                                        </span>
                                    </span>
                                )}
                            </button>
                        );
                    })}
                </div>
                <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[15px] text-slate-700">
                    {(['ok', 'fail', 'snapshot', 'partial', 'missing'] as DayState[]).map((s) => (
                        <li key={s} className="flex items-center gap-1">
                            <span className={cn('inline-flex h-5 w-6 items-center justify-center rounded border text-xs font-bold', STATE_STYLE[s])} aria-hidden="true">
                                {STATE_MARK[s]}
                            </span>
                            {STATE_LABEL[s]}
                        </li>
                    ))}
                </ul>
                <p className="mt-2 text-[15px] text-slate-600">狭い画面ではマスの中の数字を省いています。日付を押すとその日の詳細が下に出ます。</p>
            </Panel>

            <div ref={detailRef} className="scroll-mt-28">
                {selected && (
                    <Panel className="border-teal-300" >
                        <div className="mb-2 flex items-start justify-between gap-2">
                            <SectionTitle sub={selected < METHOD_CHANGE_DATE ? '9/24 より前は取り方が違うので参考値です' : undefined}>
                                {fmtDay(selected, true)} の詳細
                            </SectionTitle>
                            <button type="button" onClick={() => { setSelected(null); setDetail(null); }} className="rounded-md p-2 hover:bg-slate-100" aria-label="詳細を閉じる">
                                <X className="h-5 w-5" />
                            </button>
                        </div>
                        {loadingDetail && (
                            <div className="flex items-center gap-2 py-6 text-[15px] text-slate-700">
                                <Loader2 className="h-5 w-5 animate-spin" /> 読み込み中…
                            </div>
                        )}
                        {detailError && <ErrorNote>読み込めませんでした（{detailError}）</ErrorNote>}
                        {detail && <DayDetailView detail={detail} />}
                    </Panel>
                )}
            </div>
        </div>
    );
}

function DayDetailView({ detail }: { detail: DayDetailResponse }) {
    const d = detail.detail;
    const snapBy = new Map((d?.snapshots ?? []).map((s) => [s.category, s]));
    const hasAny = (d?.snapshots.length ?? 0) > 0 || Object.keys(d?.new ?? {}).length > 0 || Object.keys(d?.sold ?? {}).length > 0;
    return (
        <div className="space-y-4" data-testid="day-detail">
            {detail.detailError && <ErrorNote>内訳を読み込めませんでした（{detail.detailError}）</ErrorNote>}
            {!hasAny ? (
                <EmptyState title="この日の記録はありません">掲載件数・新着・売れたのどれも記録がない日です（取得が抜けた日の可能性）。</EmptyState>
            ) : (
                <TableBox label="カテゴリ別の内訳">
                    <table className="w-full border-collapse" data-testid="day-category-table">
                        <thead>
                            <tr>
                                <th className={TH}>カテゴリ</th>
                                <th className={THR}>掲載件数</th>
                                <th className={THR}>新着</th>
                                <th className={THR}>売れた</th>
                                <th className={THR}>うち画像保存</th>
                                <th className={TH}>記録時刻</th>
                            </tr>
                        </thead>
                        <tbody>
                            {CATEGORY_ORDER.map((c) => {
                                const s = snapBy.get(c);
                                const sold = d?.sold?.[c];
                                return (
                                    <tr key={c} className="border-t border-slate-200">
                                        <td className={TD}>{catLabel(c)}</td>
                                        <td className={TDR}>{s ? fmtNum(s.url_count) : '記録なし'}</td>
                                        <td className={TDR}>{fmtNum(d?.new?.[c] ?? 0)}</td>
                                        <td className={TDR}>{fmtNum(sold?.count ?? 0)}</td>
                                        <td className={TDR}>{sold ? fmtNum(sold.with_images) : '—'}</td>
                                        <td className={TD}>{s ? fmtJst(s.scraped_at) : '—'}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </TableBox>
            )}

            <div>
                <h3 className="mb-2 text-[15px] font-bold text-slate-900">この日の実行</h3>
                {detail.runsError && <ErrorNote>実行の記録を読み込めませんでした（{detail.runsError}）</ErrorNote>}
                {detail.runs.length === 0 ? (
                    <EmptyState title="この日の実行の記録はありません" />
                ) : (
                    <div className="space-y-4">
                        {detail.runs.map((r) => (
                            <div key={r.run_id} className="rounded-lg border border-slate-200 p-3">
                                <div className="mb-2 flex flex-wrap items-center gap-2 text-[15px] font-semibold">
                                    <span className="tabular-nums">#{r.run_number}</span>
                                    <span>{eventLabel(r.event)}</span>
                                    <span className="font-normal text-slate-700">{modeLabel(r.mode)}</span>
                                    {conclusionPill(r.conclusion)}
                                </div>
                                <RunDetail run={r} />
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
