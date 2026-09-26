-- 毎晩の GitHub Actions 実行（scrape-parallel.yml）の成績を1回1行で残す。
-- 書き込みは uchina_log_scrape_run（合言葉つき）からのみ。読むのはサーバー側の service_role だけ。
-- 適用先: うちなーらいふDB（csnwgqtoioqnuoqlvcds・他アプリと共有）。既存の表・関数には触れない。

create table if not exists public.uchina_scrape_runs (
  run_id bigint primary key,            -- GitHub の実行ID
  run_number int,
  run_attempt int,
  event text,                           -- schedule / workflow_dispatch / push
  mode text,                            -- full / collect-only / mail-test
  sold_mode text,                       -- normal / dry-run / cleanup / skip（不明な旧実行は null）
  head_sha text,
  run_url text,
  snapshot_date date,                   -- 実行開始の日本時間の日付
  created_at timestamptz,               -- GitHub が実行を作った時刻
  started_at timestamptz,               -- 最初の台の開始
  finished_at timestamptz,              -- 最後の台の終了
  total_minutes numeric,
  conclusion text,                      -- success / failure / cancelled
  jobs_ok int,
  jobs_total int,
  status_text text,                     -- メールのステータス欄と同じ文言
  problems text[],
  expected_total int,
  collected_total int,
  new_total int,
  sold_total int,
  reactivated_total int,
  mail_sent boolean,                    -- null = メールを送る工程が無かった
  mail_detail text,
  source text not null default 'live' check (source in ('live', 'backfill')),
  recorded_at timestamptz not null default now()
);
create index if not exists uchina_scrape_runs_day on public.uchina_scrape_runs (snapshot_date desc);

create table if not exists public.uchina_scrape_run_categories (
  run_id bigint not null references public.uchina_scrape_runs (run_id) on delete cascade,
  category text not null,
  job_conclusion text,
  job_started_at timestamptz,
  job_finished_at timestamptz,
  job_minutes numeric,
  expected int,
  collected int,
  complete boolean,
  method text,
  seconds numeric,
  retries int,
  chunks int,
  requests int,
  api_problems text[],
  new_count int,
  sold_count int,
  sold_candidates int,
  sold_confirmed int,
  sold_still_listed int,
  sold_held int,
  sold_controls_ok boolean,
  reactivated int,
  scrape_errors int,
  sync_rows int,
  sync_written int,
  sync_outliers int,
  sync_ended int,
  sync_finalized boolean,
  sync_error text,
  elapsed_seconds numeric,
  extra jsonb,
  primary key (run_id, category)
);

-- 合言葉は sha256 だけを置く（平文はどこにも保存しない）
create table if not exists public.uchina_run_log_keys (
  id int primary key default 1,
  token_sha256 text not null
);

alter table public.uchina_scrape_runs enable row level security;
alter table public.uchina_scrape_run_categories enable row level security;
alter table public.uchina_run_log_keys enable row level security;
-- ポリシーは作らない。念のため anon / authenticated からは表そのものの権限も外す
revoke all on table public.uchina_scrape_runs from anon, authenticated;
revoke all on table public.uchina_scrape_run_categories from anon, authenticated;
revoke all on table public.uchina_run_log_keys from anon, authenticated;

-- 1回分の実行を記録する。何度呼んでも同じ run_id は1行・カテゴリは入れ替え（重複しない）。
-- 埋め戻し（backfill）は本番記録（live）を上書きしない。その場合は -1 を返す。
-- 戻り値: 書いたカテゴリ行の数
create or replace function public.uchina_log_scrape_run(p_token text, p_run jsonb, p_categories jsonb)
returns int language plpgsql security definer set search_path = public, extensions as $$
declare
  v_run_id bigint;
  v_source text;
  n int;
begin
  if p_token is null or not exists (
       select 1 from uchina_run_log_keys where token_sha256 = encode(digest(p_token, 'sha256'), 'hex')) then
    raise exception 'forbidden';
  end if;
  v_run_id := nullif(p_run->>'run_id', '')::bigint;
  if v_run_id is null then
    raise exception 'run_id is required';
  end if;
  v_source := coalesce(nullif(p_run->>'source', ''), 'live');
  if v_source = 'backfill' and exists (
       select 1 from uchina_scrape_runs where run_id = v_run_id and source = 'live') then
    return -1;
  end if;

  insert into uchina_scrape_runs as t (
    run_id, run_number, run_attempt, event, mode, sold_mode, head_sha, run_url,
    snapshot_date, created_at, started_at, finished_at, total_minutes,
    conclusion, jobs_ok, jobs_total, status_text, problems,
    expected_total, collected_total, new_total, sold_total, reactivated_total,
    mail_sent, mail_detail, source, recorded_at)
  select v_run_id, r.run_number, r.run_attempt, r.event, r.mode, r.sold_mode, r.head_sha, r.run_url,
         r.snapshot_date, r.created_at, r.started_at, r.finished_at, r.total_minutes,
         r.conclusion, r.jobs_ok, r.jobs_total, r.status_text, r.problems,
         r.expected_total, r.collected_total, r.new_total, r.sold_total, r.reactivated_total,
         r.mail_sent, r.mail_detail, v_source, now()
  from jsonb_populate_record(null::public.uchina_scrape_runs, p_run) r
  on conflict (run_id) do update set
    run_number = excluded.run_number, run_attempt = excluded.run_attempt, event = excluded.event,
    mode = excluded.mode, sold_mode = excluded.sold_mode, head_sha = excluded.head_sha, run_url = excluded.run_url,
    snapshot_date = excluded.snapshot_date, created_at = excluded.created_at, started_at = excluded.started_at,
    finished_at = excluded.finished_at, total_minutes = excluded.total_minutes, conclusion = excluded.conclusion,
    jobs_ok = excluded.jobs_ok, jobs_total = excluded.jobs_total, status_text = excluded.status_text,
    problems = excluded.problems, expected_total = excluded.expected_total, collected_total = excluded.collected_total,
    new_total = excluded.new_total, sold_total = excluded.sold_total, reactivated_total = excluded.reactivated_total,
    mail_sent = excluded.mail_sent, mail_detail = excluded.mail_detail, source = excluded.source,
    recorded_at = now();

  delete from uchina_scrape_run_categories where run_id = v_run_id;
  insert into uchina_scrape_run_categories (
    run_id, category, job_conclusion, job_started_at, job_finished_at, job_minutes,
    expected, collected, complete, method, seconds, retries, chunks, requests, api_problems,
    new_count, sold_count, sold_candidates, sold_confirmed, sold_still_listed, sold_held, sold_controls_ok,
    reactivated, scrape_errors,
    sync_rows, sync_written, sync_outliers, sync_ended, sync_finalized, sync_error,
    elapsed_seconds, extra)
  select v_run_id, c.category, c.job_conclusion, c.job_started_at, c.job_finished_at, c.job_minutes,
         c.expected, c.collected, c.complete, c.method, c.seconds, c.retries, c.chunks, c.requests, c.api_problems,
         c.new_count, c.sold_count, c.sold_candidates, c.sold_confirmed, c.sold_still_listed, c.sold_held, c.sold_controls_ok,
         c.reactivated, c.scrape_errors,
         c.sync_rows, c.sync_written, c.sync_outliers, c.sync_ended, c.sync_finalized, c.sync_error,
         c.elapsed_seconds, c.extra
  from jsonb_populate_recordset(null::public.uchina_scrape_run_categories, coalesce(p_categories, '[]'::jsonb)) c
  where c.category is not null
  on conflict (run_id, category) do nothing;  -- 同じカテゴリが2回来ても1行
  get diagnostics n = row_count;
  return n;
end $$;

revoke all on function public.uchina_log_scrape_run(text, jsonb, jsonb) from public;
grant execute on function public.uchina_log_scrape_run(text, jsonb, jsonb) to anon, authenticated;

notify pgrst, 'reload schema';
