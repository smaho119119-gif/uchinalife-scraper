'use client';

import { Loader2 } from 'lucide-react';
import type { DbResponse } from '@/app/admin/types';
import {
    CATEGORY_ORDER,
    catLabel,
    EmptyState,
    ErrorNote,
    fmtBytes,
    fmtDay,
    fmtJst,
    fmtNum,
    Panel,
    SectionTitle,
    StatTile,
    StatusPill,
    TableBox,
    TD,
    TDR,
    TH,
    THR,
} from '@/components/admin/admin-ui';

const TABLE_NOTE: Record<string, string> = {
    properties: '物件（掲載中＋売れた）',
    daily_link_snapshots: '日ごと・カテゴリごとの掲載件数（URL一覧は大きいので画面では読まない）',
    uchina_property_images: 'AIで作った画像の記録',
    uchina_scrape_runs: '毎晩の実行の記録（1回1行）',
    uchina_scrape_run_categories: '実行×カテゴリの内訳',
};

const THEME_LABEL: Record<string, string> = {
    sea: '海が見える',
    pet: 'ペット可',
    garage: 'ガレージ',
    parking2: '駐車2台以上',
    shop: '店舗付き',
};

function pct(a: number, b: number): string {
    if (!b) return '—';
    return `${((a / b) * 100).toFixed(1)}%`;
}

export function DbPanel({ data, error }: { data: DbResponse | null; error: string | null }) {
    if (!data && !error) {
        return (
            <div className="flex items-center justify-center py-16 text-slate-200">
                <Loader2 className="h-7 w-7 animate-spin" aria-label="読み込み中" />
            </div>
        );
    }
    const u = data?.uchina ?? null;
    const p = data?.propertyAi ?? null;
    const inv = new Map((u?.inventory ?? []).map((r) => [r.category, r]));
    // 読めていない時に 0 と出すと「掲載0件」と読み違えるので、データがある時だけ合計する（無ければ —）
    const invTotal = u ? u.inventory.reduce((s, r) => ({ a: s.a + r.active, s: s.s + r.sold }), { a: 0, s: 0 }) : null;
    const img = data?.imageRate?.by_category ?? [];
    const imgTotal = img.reduce((s, r) => ({ sold: s.sold + r.sold, w: s.w + r.with_images }), { sold: 0, w: 0 });
    const cmp = data?.comparison ?? [];
    const mismatches = cmp.filter((c) => c.match === false).length;

    return (
        <div className="space-y-5">
            {error && <ErrorNote>DB詳細を読み込めませんでした（{error}）</ErrorNote>}

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <StatTile label="うちなーらいふ 掲載中" value={invTotal ? `${fmtNum(invTotal.a)}件` : '—'} note="米国（us-east-1）・他アプリと共有のDB" />
                <StatTile label="PROPERTY AI 掲載中" value={p?.byCategory ? `${fmtNum(Object.values(p.byCategory).reduce((s, c) => s + (c.active ?? 0), 0))}件` : '—'} note="東京（ap-northeast-1）" />
                <StatTile
                    label="掲載中件数の突き合わせ"
                    value={cmp.length === 0 ? '—' : mismatches === 0 ? '全カテゴリ一致' : `${mismatches}カテゴリ不一致`}
                    tone={cmp.length === 0 ? undefined : mismatches === 0 ? 'ok' : 'bad'}
                />
                <StatTile label="PROPERTY AI 最終同期" value={<span className="text-xl">{fmtJst(p?.lastSyncedAt ?? null)}</span>} />
            </div>

            {/* うちなーらいふDB */}
            <Panel>
                <SectionTitle sub="Supabase csnwgqtoioqnuoqlvcds（米国・他アプリと共有）。件数はすべて正確な数（概算ではない）。">
                    うちなーらいふDB の表
                </SectionTitle>
                {data?.uchinaError && <ErrorNote>うちなーらいふDB を読めませんでした（{data.uchinaError}）</ErrorNote>}
                {u ? (
                    <>
                        <TableBox label="うちなーらいふDBの表">
                            <table className="w-full border-collapse">
                                <thead>
                                    <tr>
                                        <th className={TH}>表</th>
                                        <th className={THR}>行数</th>
                                        <th className={THR}>大きさ（合計）</th>
                                        <th className={THR}>うち索引</th>
                                        <th className={TH}>中身</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {u.tables.map((t) => (
                                        <tr key={t.name} className="border-t border-slate-200">
                                            <td className={`${TD} font-mono`}>{t.name}</td>
                                            <td className={TDR}>{fmtNum(t.rows)}</td>
                                            <td className={TDR}>{fmtBytes(t.total_bytes)}</td>
                                            <td className={TDR}>{fmtBytes(t.index_bytes)}</td>
                                            <td className={TD}>{TABLE_NOTE[t.name] ?? ''}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </TableBox>
                        <p className="mt-2 text-[15px] text-slate-600">DB全体の大きさ（他アプリの分を含む）: {fmtBytes(u.database_bytes)}</p>
                    </>
                ) : (
                    !data?.uchinaError && <EmptyState title="まだ読み込めていません" />
                )}
            </Panel>

            {/* 在庫 */}
            <Panel>
                <SectionTitle sub="properties の is_active で数えた件数。売れた＝掲載が終わったと判定した物件（累計）。">
                    在庫（カテゴリ × 掲載中 / 売れた）
                </SectionTitle>
                {u ? (
                    <TableBox label="在庫">
                        <table className="w-full border-collapse">
                            <thead>
                                <tr>
                                    <th className={TH}>カテゴリ</th>
                                    <th className={THR}>掲載中</th>
                                    <th className={THR}>売れた（累計）</th>
                                    <th className={THR}>合計</th>
                                </tr>
                            </thead>
                            <tbody>
                                {CATEGORY_ORDER.map((c) => {
                                    const r = inv.get(c);
                                    return (
                                        <tr key={c} className="border-t border-slate-200">
                                            <td className={TD}>{catLabel(c)}</td>
                                            <td className={TDR}>{fmtNum(r?.active ?? 0)}</td>
                                            <td className={TDR}>{fmtNum(r?.sold ?? 0)}</td>
                                            <td className={TDR}>{fmtNum((r?.active ?? 0) + (r?.sold ?? 0))}</td>
                                        </tr>
                                    );
                                })}
                                <tr className="border-t-2 border-slate-300 font-semibold">
                                    <td className={TD}>合計</td>
                                    <td className={TDR}>{fmtNum(invTotal?.a)}</td>
                                    <td className={TDR}>{fmtNum(invTotal?.s)}</td>
                                    <td className={TDR}>{invTotal ? fmtNum(invTotal.a + invTotal.s) : '—'}</td>
                                </tr>
                            </tbody>
                        </table>
                    </TableBox>
                ) : (
                    <EmptyState title="在庫を読み込めていません" />
                )}
            </Panel>

            {/* スナップショット */}
            <Panel>
                <SectionTitle sub="daily_link_snapshots（毎日の掲載件数の記録）。日付は日本時間。">掲載件数の記録の範囲と抜けた日</SectionTitle>
                {u ? (
                    <div className="space-y-2 text-[15px] text-slate-900">
                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
                            <div>
                                期間: <span className="font-semibold">{fmtDay(u.snapshots.first_date, true)}〜{fmtDay(u.snapshots.last_date, true)}</span>
                            </div>
                            <div>
                                記録のある日: <span className="font-semibold tabular-nums">{fmtNum(u.snapshots.days)}日</span>（{fmtNum(u.snapshots.rows)}行）
                            </div>
                            <div>
                                最後の記録: <span className="font-semibold">{fmtJst(u.snapshots.last_scraped_at)}</span>
                            </div>
                            <div>
                                物件の最終更新: <span className="font-semibold">{fmtJst(u.properties_last_updated_at)}</span>
                            </div>
                        </div>
                        <div>
                            <span className="font-semibold">記録が無い日: </span>
                            <span className="tabular-nums">{u.snapshots.missing_days.length}日</span>
                            {u.snapshots.missing_days.length > 0 && (
                                <span className="text-slate-700">
                                    （直近: {u.snapshots.missing_days.slice(-12).map((d) => fmtDay(d)).join('、')}
                                    {u.snapshots.missing_days.length > 12 ? ' ほか' : ''}）
                                </span>
                            )}
                        </div>
                        <div>
                            <span className="font-semibold">8種類そろっていない日: </span>
                            {u.snapshots.partial_days.length === 0
                                ? 'なし'
                                : u.snapshots.partial_days.map((d) => `${fmtDay(d.date)}（${d.categories}種類）`).join('、')}
                        </div>
                    </div>
                ) : (
                    <EmptyState title="まだ読み込めていません" />
                )}
            </Panel>

            {/* 画像の保存率 */}
            <Panel>
                <SectionTitle
                    sub={
                        data?.imageRate
                            ? `売れたと判定した物件の写真（最大3枚）を保存できた割合。直近30日（${fmtDay(data.imageRate.from)}〜${fmtDay(data.imageRate.to)}）。`
                            : '売れたと判定した物件の写真（最大3枚）を保存できた割合。直近30日。'
                    }
                >
                    売れた物件の画像保存率
                </SectionTitle>
                {data?.imageRateError && <ErrorNote>画像保存率を読めませんでした（{data.imageRateError}）</ErrorNote>}
                {data?.imageRate &&
                    (img.length === 0 ? (
                        <EmptyState title="直近30日に売れた物件はありません" />
                    ) : (
                        <TableBox label="画像保存率">
                            <table className="w-full border-collapse">
                                <thead>
                                    <tr>
                                        <th className={TH}>カテゴリ</th>
                                        <th className={THR}>売れた</th>
                                        <th className={THR}>画像あり</th>
                                        <th className={THR}>保存率</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {img.map((r) => (
                                        <tr key={r.category} className="border-t border-slate-200">
                                            <td className={TD}>{catLabel(r.category)}</td>
                                            <td className={TDR}>{fmtNum(r.sold)}</td>
                                            <td className={TDR}>{fmtNum(r.with_images)}</td>
                                            <td className={TDR}>{pct(r.with_images, r.sold)}</td>
                                        </tr>
                                    ))}
                                    <tr className="border-t-2 border-slate-300 font-semibold">
                                        <td className={TD}>合計</td>
                                        <td className={TDR}>{fmtNum(imgTotal.sold)}</td>
                                        <td className={TDR}>{fmtNum(imgTotal.w)}</td>
                                        <td className={TDR}>{pct(imgTotal.w, imgTotal.sold)}</td>
                                    </tr>
                                </tbody>
                            </table>
                        </TableBox>
                    ))}
            </Panel>

            {/* PROPERTY AI */}
            <Panel>
                <SectionTitle sub="Supabase rtrorhmmsjvbmlulcxra（東京）の property_ai_market_listings / _prices。公開の集計（件数だけ）を読んでいます。">
                    PROPERTY AI（東京）への同期
                </SectionTitle>
                {data?.propertyAiError && <ErrorNote>取得できませんでした（{data.propertyAiError}）</ErrorNote>}
                {!p ? (
                    !data?.propertyAiError && <EmptyState title="取得できませんでした" />
                ) : (
                    <div className="space-y-4">
                        <TableBox label="掲載中件数の突き合わせ">
                            <table className="w-full border-collapse" data-testid="sync-compare-table">
                                <thead>
                                    <tr>
                                        <th className={TH}>カテゴリ</th>
                                        <th className={THR}>うちなーらいふ 掲載中</th>
                                        <th className={THR}>PROPERTY AI 掲載中</th>
                                        <th className={THR}>差</th>
                                        <th className={TH}>判定</th>
                                        <th className={THR}>PROPERTY AI 掲載終了</th>
                                        <th className={THR}>外れ値</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {cmp.map((c) => (
                                        <tr key={c.category} className="border-t border-slate-200">
                                            <td className={TD}>{catLabel(c.category)}</td>
                                            <td className={TDR}>{fmtNum(c.uchina)}</td>
                                            <td className={TDR}>{fmtNum(c.propertyAi)}</td>
                                            <td className={TDR}>{c.diff === null ? '—' : c.diff > 0 ? `+${fmtNum(c.diff)}` : fmtNum(c.diff)}</td>
                                            <td className={TD}>
                                                {c.match === true ? <StatusPill tone="ok">✓ 一致</StatusPill> : c.match === false ? <StatusPill tone="bad">✕ 不一致</StatusPill> : <StatusPill tone="muted">比べられない</StatusPill>}
                                            </td>
                                            <td className={TDR}>{fmtNum(p.byCategory?.[c.category]?.ended ?? null)}</td>
                                            <td className={TDR}>{fmtNum(p.byCategory?.[c.category]?.outliers ?? null)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </TableBox>
                        <p className="text-[15px] text-slate-600">
                            外れ値 = 相場推定に使わない行。賃貸・駐車場は売買の相場に使わないため全件が外れ値扱いになっています。集計日 {p.asOf ?? '—'}・異なる物件 {fmtNum(p.uniqueProperties ?? null)}件。
                        </p>

                        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                            <div>
                                <h3 className="mb-2 text-[15px] font-bold">お気に入り数</h3>
                                <ul className="space-y-1 text-[15px] tabular-nums">
                                    <li>入っている: {fmtNum(p.favorites?.filled ?? null)}件</li>
                                    <li>1以上: {fmtNum(p.favorites?.positive ?? null)}件</li>
                                    <li>最大: {fmtNum(p.favorites?.max ?? null)}</li>
                                </ul>
                            </div>
                            <div>
                                <h3 className="mb-2 text-[15px] font-bold">テーマ（該当件数）</h3>
                                <ul className="space-y-1 text-[15px] tabular-nums">
                                    {Object.entries(p.themes ?? {}).length === 0 ? (
                                        <li>—</li>
                                    ) : (
                                        Object.entries(p.themes ?? {}).map(([k, v]) => (
                                            <li key={k}>
                                                {THEME_LABEL[k] ?? k}: {fmtNum(v)}件
                                            </li>
                                        ))
                                    )}
                                </ul>
                            </div>
                            <div>
                                <h3 className="mb-2 text-[15px] font-bold">写真・動画</h3>
                                <ul className="space-y-1 text-[15px] tabular-nums">
                                    <li>写真の枚数が入っている: {fmtNum(p.media?.imageCountFilled ?? null)}件</li>
                                    <li>動画あり: {fmtNum(p.media?.withVideo ?? null)}件</li>
                                </ul>
                            </div>
                        </div>

                        {(p.prices?.length ?? 0) > 0 && (
                            <div>
                                <h3 className="mb-2 text-[15px] font-bold">価格の記録（日別）</h3>
                                <TableBox label="価格の記録">
                                    <table className="w-full border-collapse">
                                        <thead>
                                            <tr>
                                                <th className={TH}>日付</th>
                                                <th className={THR}>行数</th>
                                                <th className={THR}>お気に入り数あり</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {[...(p.prices ?? [])].reverse().map((r) => (
                                                <tr key={r.day} className="border-t border-slate-200">
                                                    <td className={TD}>{fmtDay(r.day, true)}</td>
                                                    <td className={TDR}>{fmtNum(r.rows)}</td>
                                                    <td className={TDR}>{fmtNum(r.withFavorite)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </TableBox>
                            </div>
                        )}
                    </div>
                )}
            </Panel>
        </div>
    );
}
