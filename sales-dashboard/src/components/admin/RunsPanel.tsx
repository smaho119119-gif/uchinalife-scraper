'use client';

import { Fragment, useMemo, useState } from 'react';
import {
    Bar,
    BarChart,
    CartesianGrid,
    Legend,
    Line,
    LineChart,
    ReferenceLine,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts';
import { ChevronDown, ChevronRight, ExternalLink, Loader2 } from 'lucide-react';
import type { Run, RunCategory, RunsResponse } from '@/app/admin/types';
import {
    addDays,
    CATEGORY_ORDER,
    CHART,
    catLabel,
    conclusionPill,
    dayDiff,
    runPill,
    EmptyState,
    ErrorNote,
    eventLabel,
    fmtDay,
    fmtJst,
    fmtJstTime,
    fmtMinutes,
    fmtNum,
    METHOD_CHANGE_DATE,
    modeLabel,
    Panel,
    scheduleDelayMinutes,
    SectionTitle,
    StatusPill,
    TableBox,
    TD,
    TDR,
    TH,
    THR,
} from '@/components/admin/admin-ui';

interface Props {
    data: RunsResponse | null;
    error: string | null;
}

const shortDay = (ymd: string) => {
    const [, m, d] = ymd.split('-').map(Number);
    return `${m}/${d}`;
};

/** 連続する日付をまとめて「9/16〜9/23（8日）」の形に */
function toRanges(days: string[]): { from: string; to: string; n: number }[] {
    const out: { from: string; to: string; n: number }[] = [];
    for (const d of [...days].sort()) {
        const last = out[out.length - 1];
        if (last && dayDiff(last.to, d) === 1) {
            last.to = d;
            last.n += 1;
        } else {
            out.push({ from: d, to: d, n: 1 });
        }
    }
    return out;
}

export function RunsPanel({ data, error }: Props) {
    const [openRun, setOpenRun] = useState<number | null>(null);
    const [range, setRange] = useState<'90' | 'all'>('90');

    const today = data?.todayJst ?? '';

    // 掲載件数の推移（全期間・カテゴリ別）と抜けた日
    const trend = useMemo(() => {
        const snaps = data?.daily?.snapshots ?? [];
        if (snaps.length === 0 || !today) return null;
        const first = snaps.reduce((m, s) => (s.date < m ? s.date : m), snaps[0].date);
        const byDate = new Map<string, Record<string, number | null>>();
        for (const s of snaps) {
            const row = byDate.get(s.date) ?? {};
            row[s.category] = s.url_count;
            byDate.set(s.date, row);
        }
        const rows: Record<string, string | number | null>[] = [];
        const missing: string[] = [];
        const partial: { date: string; n: number }[] = [];
        for (let d = first; d <= today; d = addDays(d, 1)) {
            const r = byDate.get(d);
            if (!r) missing.push(d);
            else if (Object.keys(r).length < CATEGORY_ORDER.length) partial.push({ date: d, n: Object.keys(r).length });
            rows.push({ date: d, ...Object.fromEntries(CATEGORY_ORDER.map((c) => [c, r?.[c] ?? null])) });
        }
        return { first, rows, missing, partial };
    }, [data?.daily?.snapshots, today]);

    // 新着・売れたの日別
    const daily = data?.daily ?? null;
    const trendFirst = trend?.first ?? null;
    const flow = useMemo(() => {
        if (!daily || !today) return [];
        const newBy = new Map(daily.new.map((r) => [r.date, r.count]));
        const soldBy = new Map(daily.sold.map((r) => [r.date, r.count]));
        const start = range === '90' ? addDays(today, -89) : (trendFirst ?? daily.from);
        const rows: { date: string; 新着: number; 売れた: number }[] = [];
        for (let d = start; d <= today; d = addDays(d, 1)) {
            rows.push({ date: d, 新着: newBy.get(d) ?? 0, 売れた: soldBy.get(d) ?? 0 });
        }
        return rows;
    }, [daily, today, range, trendFirst]);

    if (!data && !error) {
        return (
            <div className="flex items-center justify-center py-16 text-slate-200">
                <Loader2 className="h-7 w-7 animate-spin" aria-label="読み込み中" />
            </div>
        );
    }

    const runs = data?.runs ?? [];
    const active = data?.active;

    return (
        <div className="space-y-5">
            {error && <ErrorNote>取得履歴を読み込めませんでした（{error}）</ErrorNote>}

            {/* 実行中・待機中 */}
            {active && active.runs.length > 0 && (
                <Panel className="border-teal-300 bg-teal-50">
                    <SectionTitle>いま動いている実行</SectionTitle>
                    <ul className="space-y-2">
                        {active.runs.map((r) => (
                            <li key={r.id} className="flex flex-wrap items-center gap-2 text-[15px]">
                                <Loader2 className="h-4 w-4 animate-spin text-teal-700" aria-hidden="true" />
                                <span className="font-semibold tabular-nums">#{r.run_number}</span>
                                <span>{eventLabel(r.event)}</span>
                                <StatusPill tone="info">{r.status === 'queued' ? '待機中' : r.status === 'in_progress' ? '実行中' : r.status}</StatusPill>
                                <span className="text-slate-700">作成 {fmtJst(r.created_at)}</span>
                                <a href={r.html_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-semibold text-teal-800 underline">
                                    GitHubで見る <ExternalLink className="h-4 w-4" aria-hidden="true" />
                                </a>
                            </li>
                        ))}
                    </ul>
                </Panel>
            )}
            {active?.error && (
                <p className="text-[15px] text-slate-300">GitHub から実行中の情報を取得できませんでした（{active.error}）。記録済みの実行は下に出ています。</p>
            )}

            {/* 掲載件数の推移 */}
            <Panel>
                <SectionTitle
                    sub={
                        <>
                            daily_link_snapshots の全期間（{trend ? `${fmtDay(trend.first, true)}〜` : '—'}）。カテゴリごとに目盛りが違います。線が切れている所は取得が抜けた日です。
                            <br />
                            <strong className="text-amber-800">{fmtDay(METHOD_CHANGE_DATE, true)} より前の数字は取り方が違う（住居が途中で切れていた）ので参考値です。</strong>
                        </>
                    }
                >
                    掲載件数の推移（カテゴリ別）
                </SectionTitle>
                {data?.dailyError && <ErrorNote>推移を読み込めませんでした（{data.dailyError}）</ErrorNote>}
                {!trend ? (
                    <EmptyState title={!data?.daily ? '読み込めなかったため表示できません' : '掲載件数の記録がまだありません'} />
                ) : (
                    <>
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                            {CATEGORY_ORDER.map((c) => (
                                <div key={c} className="min-w-0">
                                    <div className="mb-1 text-[15px] font-semibold text-slate-800">
                                        {catLabel(c)}
                                        <span className="ml-2 font-normal tabular-nums text-slate-600">
                                            最新 {fmtNum(trend.rows[trend.rows.length - 1]?.[c] as number | null)}件
                                        </span>
                                    </div>
                                    <div className="h-36 w-full">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <LineChart data={trend.rows} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                                                <CartesianGrid vertical={false} stroke={CHART.grid} />
                                                <XAxis dataKey="date" tickFormatter={shortDay} tick={{ fontSize: 15, fill: CHART.axis }} minTickGap={40} />
                                                <YAxis width={60} tick={{ fontSize: 15, fill: CHART.axis }} tickFormatter={(v: number) => v.toLocaleString('ja-JP')} domain={['auto', 'auto']} />
                                                <Tooltip
                                                    labelFormatter={(l) => fmtDay(String(l), true)}
                                                    formatter={(v) => [v === null || v === undefined ? '記録なし' : `${Number(v).toLocaleString('ja-JP')}件`, catLabel(c)]}
                                                />
                                                <ReferenceLine x={METHOD_CHANGE_DATE} stroke="#b45309" strokeDasharray="4 3" />
                                                <Line type="linear" dataKey={c} stroke={CHART.primary} strokeWidth={2} dot={false} connectNulls={false} isAnimationActive={false} />
                                            </LineChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className="mt-4 space-y-1 text-[15px] text-slate-800">
                            <div>
                                <span className="font-semibold">取得が抜けた日（記録なし）:</span>{' '}
                                {trend.missing.length === 0 ? (
                                    'なし'
                                ) : (
                                    <>
                                        <span className="tabular-nums">{trend.missing.length}日</span> —{' '}
                                        {toRanges(trend.missing)
                                            .map((r) => (r.n === 1 ? fmtDay(r.from) : `${fmtDay(r.from)}〜${fmtDay(r.to)}（${r.n}日）`))
                                            .join('、')}
                                    </>
                                )}
                            </div>
                            <div>
                                <span className="font-semibold">8種類そろっていない日:</span>{' '}
                                {trend.partial.length === 0
                                    ? 'なし'
                                    : trend.partial.map((p) => `${fmtDay(p.date)}（${p.n}種類）`).join('、')}
                            </div>
                        </div>
                    </>
                )}
            </Panel>

            {/* 新着・売れたの日別 */}
            <Panel>
                <div className="flex flex-wrap items-start justify-between gap-2">
                    <SectionTitle sub="新着 = その日に初めて見つけた物件（first_seen_date）／売れた = 掲載が終わったと判定した日（last_seen_date・掲載中でない物件）">
                        新着・売れたの日別
                    </SectionTitle>
                    <div className="flex gap-1" role="group" aria-label="期間">
                        {(['90', 'all'] as const).map((r) => (
                            <button
                                key={r}
                                type="button"
                                onClick={() => setRange(r)}
                                aria-pressed={range === r}
                                className={`rounded-md border px-3 py-1.5 text-[15px] font-semibold ${range === r ? 'border-teal-700 bg-teal-700 text-white' : 'border-slate-300 bg-white text-slate-800 hover:border-teal-500'}`}
                            >
                                {r === '90' ? '直近90日' : '全期間'}
                            </button>
                        ))}
                    </div>
                </div>
                {flow.length === 0 ? (
                    <EmptyState title={!daily ? '読み込めなかったため表示できません' : '新着・売れたの記録がまだありません'} />
                ) : (
                    <div className="h-72 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={flow} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barGap={1}>
                                <CartesianGrid vertical={false} stroke={CHART.grid} />
                                <XAxis dataKey="date" tickFormatter={shortDay} tick={{ fontSize: 15, fill: CHART.axis }} minTickGap={32} />
                                <YAxis width={62} tick={{ fontSize: 15, fill: CHART.axis }} tickFormatter={(v: number) => v.toLocaleString('ja-JP')} />
                                <Tooltip
                                    labelFormatter={(l) => {
                                        const d = String(l);
                                        return `${fmtDay(d, true)}${d < METHOD_CHANGE_DATE ? '（参考値）' : ''}`;
                                    }}
                                    formatter={(v, name) => [`${Number(v).toLocaleString('ja-JP')}件`, String(name)]}
                                    cursor={{ fill: '#f1f5f9' }}
                                />
                                <Legend wrapperStyle={{ fontSize: 15 }} formatter={(v) => <span className="text-slate-800">{String(v)}</span>} />
                                <ReferenceLine x={METHOD_CHANGE_DATE} stroke="#b45309" strokeDasharray="4 3" />
                                <Bar dataKey="新着" fill={CHART.new} radius={[2, 2, 0, 0]} isAnimationActive={false} />
                                <Bar dataKey="売れた" fill={CHART.sold} radius={[2, 2, 0, 0]} isAnimationActive={false} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                )}
                <p className="mt-2 text-[15px] text-slate-600">点線（{fmtDay(METHOD_CHANGE_DATE)}）より左は参考値。9/25 の売れたが多いのは、溜まっていた分を一掃した日のため。</p>
            </Panel>

            {/* 実行の一覧 */}
            <Panel>
                <SectionTitle sub="GitHub Actions（scrape-parallel.yml）の1回の実行が1行。行を押すとカテゴリ別の内訳が開きます。日付・時刻は日本時間。">
                    実行の一覧
                </SectionTitle>
                {data?.runsError && <ErrorNote>実行の記録を読み込めませんでした（{data.runsError}）</ErrorNote>}
                {runs.length === 0 && (!data || data.runsError) ? (
                    <EmptyState title="読み込めなかったため表示できません">
                        GitHub 側の実行は
                        <a href={data?.workflowUrl ?? 'https://github.com/smaho119119-gif/uchinalife-scraper/actions/workflows/scrape-parallel.yml'} target="_blank" rel="noopener noreferrer" className="mx-1 font-semibold text-teal-800 underline">
                            GitHub Actions
                        </a>
                        で見られます。
                    </EmptyState>
                ) : runs.length === 0 ? (
                    <EmptyState title="実行の記録がまだありません">
                        毎晩の取得が終わるとここに1行ずつ増えます。GitHub 側の実行は
                        <a href={data?.workflowUrl} target="_blank" rel="noopener noreferrer" className="mx-1 font-semibold text-teal-800 underline">
                            GitHub Actions
                        </a>
                        で見られます。
                    </EmptyState>
                ) : (
                    <TableBox label="実行の一覧">
                        <table className="w-full border-collapse">
                            <thead>
                                <tr>
                                    <th className={TH}>日付</th>
                                    <th className={TH}>結果</th>
                                    <th className={TH}>起動</th>
                                    <th className={TH}>モード</th>
                                    <th className={THR}>予定からの遅れ</th>
                                    <th className={THR}>所要</th>
                                    <th className={THR}>掲載合計</th>
                                    <th className={THR}>新着</th>
                                    <th className={THR}>売れた</th>
                                    <th className={TH}>メール</th>
                                </tr>
                            </thead>
                            <tbody>
                                {runs.map((r) => (
                                    <RunRow key={r.run_id} run={r} open={openRun === r.run_id} onToggle={() => setOpenRun(openRun === r.run_id ? null : r.run_id)} />
                                ))}
                            </tbody>
                        </table>
                    </TableBox>
                )}
            </Panel>
        </div>
    );
}

function RunRow({ run, open, onToggle }: { run: Run; open: boolean; onToggle: () => void }) {
    const delay = scheduleDelayMinutes(run.snapshot_date, run.created_at, run.event);
    return (
        <Fragment>
            <tr
                className={`cursor-pointer border-t border-slate-200 ${open ? 'bg-teal-50' : 'hover:bg-slate-50'}`}
                onClick={onToggle}
                data-run-id={run.run_id}
            >
                <td className={TD}>
                    <button
                        type="button"
                        onClick={(e) => {
                            e.stopPropagation();
                            onToggle();
                        }}
                        aria-expanded={open}
                        className="inline-flex items-center gap-1 font-semibold text-slate-900"
                    >
                        {open ? <ChevronDown className="h-4 w-4" aria-hidden="true" /> : <ChevronRight className="h-4 w-4" aria-hidden="true" />}
                        {fmtDay(run.snapshot_date, true)}
                        <span className="ml-1 font-normal tabular-nums text-slate-600">#{run.run_number ?? '—'}</span>
                    </button>
                </td>
                <td className={TD}>{runPill(run)}</td>
                <td className={TD}>{eventLabel(run.event)}</td>
                <td className={TD}>{modeLabel(run.mode)}</td>
                <td className={TDR}>
                    {delay === null ? '—' : delay <= 30 ? `${delay}分` : <span className="font-semibold text-amber-800">{fmtMinutes(delay)}</span>}
                </td>
                <td className={TDR}>{fmtMinutes(run.total_minutes)}</td>
                <td className={TDR}>{fmtNum(run.collected_total)}</td>
                <td className={TDR}>{fmtNum(run.new_total)}</td>
                <td className={TDR}>{fmtNum(run.sold_total)}</td>
                <td className={TD}>
                    {run.mail_sent === true ? <StatusPill tone="ok">送信</StatusPill> : run.mail_sent === false ? <StatusPill tone="bad">失敗</StatusPill> : '—'}
                </td>
            </tr>
            {open && (
                <tr className="border-t border-slate-200 bg-slate-50">
                    <td colSpan={10} className="px-3 py-3">
                        <RunDetail run={run} />
                    </td>
                </tr>
            )}
        </Fragment>
    );
}

function yesNo(v: boolean | null | undefined) {
    if (v === true) return <span className="font-semibold text-teal-800">✓ 完全</span>;
    if (v === false) return <span className="font-semibold text-red-700">✕ 不完全</span>;
    return '—';
}

export function RunDetail({ run }: { run: Run }) {
    const cats = [...run.categories].sort(
        (a, b) => CATEGORY_ORDER.indexOf(a.category as (typeof CATEGORY_ORDER)[number]) - CATEGORY_ORDER.indexOf(b.category as (typeof CATEGORY_ORDER)[number]),
    );
    return (
        <div className="space-y-3 whitespace-normal" data-testid="run-detail">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[15px] text-slate-800">
                <span>作成 {fmtJst(run.created_at)}</span>
                <span>開始 {fmtJstTime(run.started_at)}</span>
                <span>終了 {fmtJstTime(run.finished_at)}</span>
                <span>
                    台数 {fmtNum(run.jobs_ok)}/{fmtNum(run.jobs_total)} 成功
                </span>
                <span>売れた判定: {run.sold_mode ?? '—'}</span>
                {run.source === 'backfill' && <StatusPill tone="muted">後から埋め戻した記録</StatusPill>}
                {run.run_url && (
                    <a href={run.run_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-semibold text-teal-800 underline">
                        GitHub の実行ページ <ExternalLink className="h-4 w-4" aria-hidden="true" />
                    </a>
                )}
            </div>
            <div className="flex flex-wrap items-center gap-2 text-[15px] text-slate-800" data-testid="run-status">
                <span className="font-semibold">状態:</span>
                {runPill(run)}
                {run.problems && run.problems.length > 0
                    ? <span>問題 {run.problems.length}件（下に一覧）</span>
                    : run.status_text && run.status_text !== '成功' && <span>{run.status_text.split('\n')[0]}</span>}
            </div>
            {run.problems && run.problems.length > 0 && (
                <ul className="list-disc space-y-0.5 pl-5 text-[15px] text-red-800">
                    {run.problems.map((p, i) => (
                        <li key={i}>{p}</li>
                    ))}
                </ul>
            )}
            {run.mail_detail && <div className="text-[15px] text-slate-600">メール: {run.mail_detail}</div>}
            {cats.length === 0 ? (
                <EmptyState title="カテゴリ別の記録がありません" />
            ) : (
                <TableBox label="カテゴリ別の内訳">
                    <table className="w-full border-collapse bg-white" data-testid="run-category-table">
                        <thead>
                            <tr>
                                <th className={TH}>カテゴリ</th>
                                <th className={THR}>サイト件数</th>
                                <th className={THR}>取得件数</th>
                                <th className={TH}>完全か</th>
                                <th className={TH}>方式</th>
                                <th className={THR}>秒</th>
                                <th className={THR}>取り直し</th>
                                <th className={THR}>新着</th>
                                <th className={THR}>売れた 候補→確定</th>
                                <th className={THR}>保留</th>
                                <th className={THR}>同期件数</th>
                                <th className={THR}>掲載終了</th>
                            </tr>
                        </thead>
                        <tbody>
                            {cats.map((c: RunCategory) => (
                                <tr key={c.category} className="border-t border-slate-200">
                                    <td className={TD}>
                                        {catLabel(c.category)}
                                        {c.job_conclusion && c.job_conclusion !== 'success' && (
                                            <span className="ml-2">{conclusionPill(c.job_conclusion)}</span>
                                        )}
                                    </td>
                                    <td className={TDR}>{fmtNum(c.expected)}</td>
                                    <td className={TDR}>{fmtNum(c.collected)}</td>
                                    <td className={TD}>{yesNo(c.complete)}</td>
                                    <td className={TD}>{c.method ?? '—'}</td>
                                    <td className={TDR}>{c.seconds === null || c.seconds === undefined ? '—' : Math.round(Number(c.seconds)).toLocaleString('ja-JP')}</td>
                                    <td className={TDR}>{fmtNum(c.retries)}</td>
                                    <td className={TDR}>{fmtNum(c.new_count)}</td>
                                    <td className={TDR}>
                                        {fmtNum(c.sold_candidates)} → {fmtNum(c.sold_confirmed ?? c.sold_count)}
                                    </td>
                                    <td className={TDR}>{fmtNum(c.sold_held)}</td>
                                    <td className={TDR}>{fmtNum(c.sync_rows ?? c.sync_written)}</td>
                                    <td className={TDR}>{fmtNum(c.sync_ended)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </TableBox>
            )}
            {cats.some((c) => c.sync_error) && (
                <ErrorNote>
                    PROPERTY AI への同期でエラー: {cats.filter((c) => c.sync_error).map((c) => `${catLabel(c.category)}: ${c.sync_error}`).join(' / ')}
                </ErrorNote>
            )}
        </div>
    );
}
