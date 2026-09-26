-- 管理画面（home-sales.nextcode.ltd/admin）の読み取り専用の集計関数。
-- 適用先: うちなーらいふDB（csnwgqtoioqnuoqlvcds・他アプリと共有）。既存の表・関数・ポリシーには触れない。
-- 呼べるのはサーバー側の service_role だけ（anon / authenticated / public からは外す）。
--
-- 8秒の制限（authenticator の statement_timeout）に収めるための決まり:
--   * daily_link_snapshots の urls 列（jsonb・合計36MB）は一切読まない。件数は url_count を使う
--   * 期間の長い集計は「索引だけで数えられる形」にする（新着= first_seen_date の索引、売れた= is_active=false の部分索引）
--   * 物件の中身（カテゴリ・画像の有無）まで見る集計は1日分 or 最大31日分に絞り、関数を分けて別々に呼ぶ
-- 索引は足していない。
--
-- 日付はすべて日本時間。スクレイパーは TZ=Asia/Tokyo で動き first_seen_date / last_seen_date を日本時間の日付で書く。

-- ─────────────────────────────────────────────
-- 1) DB の概要: 表ごとの件数と大きさ・在庫（カテゴリ×掲載中/売れた）・スナップショットの範囲と抜けた日
-- ─────────────────────────────────────────────
create or replace function public.uchina_admin_db_overview()
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_today date := (now() at time zone 'Asia/Tokyo')::date;
  v_tables jsonb := '[]'::jsonb;
  v_name text;
  v_rel regclass;
  v_rows bigint;
  v_inventory jsonb;
  v_prop_total bigint;
  v_snap jsonb;
  v_first date;
  v_last date;
begin
  -- 在庫: カテゴリ×掲載中/売れた（索引 (is_active, category) だけで数える）
  select coalesce(jsonb_agg(jsonb_build_object(
           'category', category, 'active', active, 'sold', sold) order by category), '[]'::jsonb),
         coalesce(sum(active + sold), 0)
    into v_inventory, v_prop_total
  from (
    select category,
           count(*) filter (where is_active) as active,
           count(*) filter (where not is_active) as sold
    from public.properties
    group by category
  ) s;

  -- 表ごとの件数（すべて正確な件数）と大きさ。無い表は飛ばす
  foreach v_name in array array[
      'properties', 'daily_link_snapshots', 'uchina_property_images',
      'uchina_scrape_runs', 'uchina_scrape_run_categories'] loop
    v_rel := to_regclass('public.' || v_name);
    continue when v_rel is null;
    if v_name = 'properties' then
      v_rows := v_prop_total;  -- 上の在庫集計の合計（同じ表を2回数えない）
    else
      execute format('select count(*) from %s', v_rel) into v_rows;
    end if;
    v_tables := v_tables || jsonb_build_object(
      'name', v_name,
      'rows', v_rows,
      'total_bytes', pg_total_relation_size(v_rel),
      'table_bytes', pg_relation_size(v_rel),
      'index_bytes', pg_indexes_size(v_rel));
  end loop;

  -- スナップショット（urls 列は読まない）
  select min(snapshot_date), max(snapshot_date) into v_first, v_last
  from public.daily_link_snapshots;

  select jsonb_build_object(
    'first_date', v_first,
    'last_date', v_last,
    'rows', (select count(*) from public.daily_link_snapshots),
    'days', (select count(distinct snapshot_date) from public.daily_link_snapshots),
    'last_scraped_at', (select max(scraped_at) from public.daily_link_snapshots),
    -- 行が1つも無い日（最初の日〜今日。日本時間）
    'missing_days', coalesce((
      select jsonb_agg(d::date order by d)
      from generate_series(v_first, v_today, interval '1 day') d
      where not exists (select 1 from public.daily_link_snapshots s where s.snapshot_date = d::date)
    ), '[]'::jsonb),
    -- 8種類そろっていない日
    'partial_days', coalesce((
      select jsonb_agg(jsonb_build_object('date', snapshot_date, 'categories', n) order by snapshot_date)
      from (select snapshot_date, count(*) as n from public.daily_link_snapshots group by snapshot_date) x
      where n < 8
    ), '[]'::jsonb)
  ) into v_snap;

  return jsonb_build_object(
    'today_jst', v_today,
    'database_bytes', pg_database_size(current_database()),
    'tables', v_tables,
    'inventory', v_inventory,
    'snapshots', v_snap,
    'properties_last_updated_at', (select max(updated_at) from public.properties)
  );
end $$;

-- ─────────────────────────────────────────────
-- 2) 日別の推移（最大400日）: 掲載件数（カテゴリ別・スナップショット）＋ 新着/売れた（日ごとの合計）
--    新着・売れたは索引だけで数える（物件の行は読まない）ので長い期間でも速い
-- ─────────────────────────────────────────────
create or replace function public.uchina_admin_daily(p_days int default 31, p_end date default null)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  with r as (
    select coalesce(p_end, (now() at time zone 'Asia/Tokyo')::date) as d_end,
           least(greatest(coalesce(p_days, 31), 1), 400) as n
  ), rng as (
    select d_end - (n - 1) as d_from, d_end as d_to from r
  )
  select jsonb_build_object(
    'from', (select d_from from rng),
    'to', (select d_to from rng),
    'snapshots', coalesce((
      select jsonb_agg(jsonb_build_object(
               'date', s.snapshot_date, 'category', s.category,
               'url_count', s.url_count, 'scraped_at', s.scraped_at)
             order by s.snapshot_date, s.category)
      from public.daily_link_snapshots s, rng
      where s.snapshot_date between rng.d_from and rng.d_to
    ), '[]'::jsonb),
    'new', coalesce((
      select jsonb_agg(jsonb_build_object('date', x.d, 'count', x.n) order by x.d)
      from (
        select p.first_seen_date as d, count(*) as n
        from public.properties p, rng
        where p.first_seen_date between rng.d_from and rng.d_to
        group by p.first_seen_date
      ) x
    ), '[]'::jsonb),
    'sold', coalesce((
      select jsonb_agg(jsonb_build_object('date', x.d, 'count', x.n) order by x.d)
      from (
        select p.last_seen_date as d, count(*) as n
        from public.properties p, rng
        where p.is_active = false and p.last_seen_date between rng.d_from and rng.d_to
        group by p.last_seen_date
      ) x
    ), '[]'::jsonb)
  );
$$;

-- ─────────────────────────────────────────────
-- 3) 1日分の内訳: カテゴリ別の掲載件数・新着・売れた・売れた物件の画像保存数
--    物件の行を読むので1日分に限る
-- ─────────────────────────────────────────────
create or replace function public.uchina_admin_day_detail(p_date date)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'date', p_date,
    'snapshots', coalesce((
      select jsonb_agg(jsonb_build_object(
               'category', s.category, 'url_count', s.url_count, 'scraped_at', s.scraped_at)
             order by s.category)
      from public.daily_link_snapshots s
      where s.snapshot_date = p_date
    ), '[]'::jsonb),
    'new', coalesce((
      select jsonb_object_agg(x.category, x.n)
      from (select p.category, count(*) as n from public.properties p
            where p.first_seen_date = p_date group by p.category) x
    ), '{}'::jsonb),
    'sold', coalesce((
      select jsonb_object_agg(x.category, jsonb_build_object('count', x.n, 'with_images', x.img))
      from (select p.category, count(*) as n,
                   count(*) filter (where jsonb_typeof(p.generated_images) = 'array'
                                      and jsonb_array_length(p.generated_images) > 0) as img
            from public.properties p
            where p.is_active = false and p.last_seen_date = p_date
            group by p.category) x
    ), '{}'::jsonb)
  );
$$;

-- ─────────────────────────────────────────────
-- 4) 売れた物件の画像保存率（直近 p_days 日・最大31日）
--    画像（generated_images）は売れたと判定した時に保存する。物件の行を読むので期間を絞る
-- ─────────────────────────────────────────────
create or replace function public.uchina_admin_image_rate(p_days int default 30)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  with rng as (
    select (now() at time zone 'Asia/Tokyo')::date - (least(greatest(coalesce(p_days, 30), 1), 31) - 1) as d_from,
           (now() at time zone 'Asia/Tokyo')::date as d_to
  )
  select jsonb_build_object(
    'from', (select d_from from rng),
    'to', (select d_to from rng),
    'by_category', coalesce((
      select jsonb_agg(jsonb_build_object('category', x.category, 'sold', x.n, 'with_images', x.img)
                       order by x.category)
      from (
        select p.category, count(*) as n,
               count(*) filter (where jsonb_typeof(p.generated_images) = 'array'
                                  and jsonb_array_length(p.generated_images) > 0) as img
        from public.properties p, rng
        where p.is_active = false and p.last_seen_date between rng.d_from and rng.d_to
        group by p.category
      ) x
    ), '[]'::jsonb)
  );
$$;

-- 権限: service_role だけが呼べる
revoke all on function public.uchina_admin_db_overview() from public, anon, authenticated;
revoke all on function public.uchina_admin_daily(int, date) from public, anon, authenticated;
revoke all on function public.uchina_admin_day_detail(date) from public, anon, authenticated;
revoke all on function public.uchina_admin_image_rate(int) from public, anon, authenticated;
grant execute on function public.uchina_admin_db_overview() to service_role;
grant execute on function public.uchina_admin_daily(int, date) to service_role;
grant execute on function public.uchina_admin_day_detail(date) to service_role;
grant execute on function public.uchina_admin_image_rate(int) to service_role;

notify pgrst, 'reload schema';
