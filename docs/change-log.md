# Change Log

## 2026-04-29 — Round 1: scraper stability hardening

### B-003 fix(launchd): gtimeout SIGKILL fallback
- **変更**: `run_daily_scraper.sh` の `gtimeout 7200` を `gtimeout --kill-after=300 7200` に変更
- **影響**: SIGTERM を無視するプロセスが2時間+5分後に SIGKILL される
- **副作用チェック**: shell 構文確認、`gtimeout --help` で `--kill-after` のサポート確認 (coreutils 9.x)
- **再検証**: 本日分の手動起動で gtimeout が `--kill-after=300 7200` 引数で起動しているのを `ps` で確認済み

### B-001 fix(scraper): atomic & thread-safe checkpoint write
- **変更**: `save_checkpoint` に `_checkpoint_lock` を追加。`os.replace(tmp, dst)` でアトミック書き込み
- **影響**: 並行スレッドからの破壊書き込みが消滅
- **副作用チェック**: load_checkpoint は read-only なので影響なし。tmp ファイルが残った場合の再 run でも問題ないことを確認
- **再検証**: ユニットテスト相当の手動チェック（後述）

### B-002 fix(scraper): make signal handler non-blocking
- **変更**: `_signal_handler` から `_cleanup_all_browsers()` 呼び出しを除去。`atexit` フックは維持（正常終了時のみ動く）
- **影響**: SIGTERM 受信時に即座に exit。Playwright の close デッドロックを回避
- **副作用チェック**: 正常終了パスでは atexit が動くので browser cleanup は維持される。`grep _cleanup_all_browsers` で残呼び出し箇所も確認

### B-004 fix(db): set sqlite busy_timeout
- **変更**: `_get_sqlite_connection` に `busy_timeout=30000` (30秒) を pragma で設定
- **影響**: 並行ロック競合時に 30秒待機する。即時失敗が消える
- **副作用チェック**: 既存呼び出しは `_get_sqlite_connection()` 経由のみ。grep で確認済み

### B-005 fix(health): correct consecutive failure counting
- **変更**: `check_scraper_health.sh` の連続失敗カウントロジックを修正。過去 14日で最初に当たる成功マーカーまでの距離を返す
- **影響**: 長期障害を見落とさない
- **副作用チェック**: launchd 経由の health check のみが利用。ロジック変更で警告閾値の表示が正しくなる

### B-006 fix(launchd): pidfile lock prevents duplicate runs
- **変更**: `run_daily_scraper.sh` に pidfile lock を導入。既存 pidfile + プロセス生存なら exit
- **影響**: 暴走ジョブと新規ジョブの二重実行を防止
- **副作用チェック**: trap で pidfile 確実削除を実装。kill -0 で生存確認

### B-007 chore(launchd): rotate scraper logs
- **変更**: scraper.log が 10MB 超なら日付付きでアーカイブ
- **影響**: ディスク使用量が抑制される
- **副作用チェック**: launchd の StandardOutPath は同名で append し続ける。外部 mv した直後の launchd 挙動 → 新ファイルが作られるか確認 → launchd は path に再 open しない仕様だが、本実装は run_daily_scraper.sh 内で出力リダイレクトしないので、append 先は launchd 管理下のFD。`mv` 後に新規ファイルが作られないリスクあり → ローテーションは plist の StandardOutPath を切り替えず、scraper.log を `>>` 経由で吐き出す副ログに変更する設計に修正。

### B-009 refactor(scraper): reduce browser restart churn
- **変更**: `MAX_BROWSER_USES` のデフォルトを 50 → 200
- **影響**: 同一 browser での再利用回数が増え、close→launch のリスクが減る
- **副作用チェック**: 環境変数 `SCRAPER_MAX_BROWSER_USES` で上書き可能の挙動は維持

## 2026-04-29 — Round 2: secondary defects from re-audit

### B-NEW2 fix(scraper): rebuild browser context when closed
- **変更**: `get_thread_context` で `_thread_local.context.pages` プロパティアクセスによる生存確認を追加。死んでいたら破棄→再生成。
- **影響**: `Target page, context or browser has been closed` エラーの再発を防止。
- **副作用チェック**:
  - 呼び出し元（`scrape_detail` / 内部リトライ）は `get_thread_context()` の戻り値を `context.new_page()` に渡すだけなので、戻り値型は不変
  - `_thread_local.context` のライフサイクルが「None / 生存している context」の二状態のまま
  - エラーパスで context.close() を呼ぶが既に死んでいるので例外を握りつぶす（既存のスタイルに合わせて Exception を捕捉）
  - スレッド固有変数なのでロック不要

## 2026-05-01 — Round 6: phone-friendly mail notifications

### feat(notify): SMTP relay + daily report + failure alert
- **新規**: `notify_failure.py` — XServer SMTP (sv16131.xserver.jp:465 SSL) で `info@usmc.jp` に送信。同日重複送信を `logs/alert_sent_YYYYMMDD.flag` で抑止 (`--force` で迂回可)。
- **新規**: `daily_report.py` — 成功時に毎日1通、件名に `[5/2] 🆕694 ❌712 (戸建)` のように当日サマリを乗せる。本文はカテゴリ別 new/sold + 失効物件 Top10 (高額順) + 所要時間 + ステータス。スマホで折り返し表示が崩れない plain text。
- **拡張**: `database.get_property_by_url` が title/price/genre_name_ja も返すようになった。後方互換 (既存呼び出しは url/category/images だけ読む)。
- **改修**: `integrated_scraper.main` 末尾で `daily_report.send_daily_report` を呼ぶ。`AUTO_RETRY_COUNT > 0` の子プロセスでは送信をスキップして二重送信回避。例外を吸収して exit_code=0 を保つ (mark_success の妨げにならない)。
- **改修**: `check_scraper_health.sh` が連続失敗 ≥2日で `notify_failure.py` 経由で警告メール送信。CRITICAL/WARNING の icon 付きで件名にも反映。
- **設定**: `.env` に `SMTP_*` / `ALERT_TO` を追加。XServer の認証情報は `住まい１１９フランチャイズ募集/.env.local` の値を共有。
- **テスト**: 配線確認用テストメール 1通 + サンプル daily report 1通 を実送信。XServer SMTP がエラー無く受領。
- **副作用チェック**:
  - `get_property_by_url` の戻り値拡張 → 全呼び出し元 (`integrated_scraper.py:1280` の1箇所のみ) を確認。レポート生成側は新フィールドを使い、画像アーカイブ側は既存フィールドだけ参照。
  - `daily_report` インポートを scraper 内 `try` で囲い、send 失敗時もジョブ exit_code=0 を維持。marker 作成への影響なし。
  - `.gitignore` に `logs/alert_sent_*.flag` を追加してリポジトリ汚染回避。

## 2026-04-30 — Round 5: real-world validation

- **4/29 manual run completed**: 5,308 properties scraped (errors 0), CSV
  exported for all 8 categories, success_20260429.marker created. The 5-day
  failure streak is broken.
- **4/30 launchd run completed automatically** for the first time on the new
  code: success_20260430.marker exists, last_run.json reports status=success.
  This validates the fix end-to-end without manual intervention.
- One quirk surfaced during the manual run: `auto_diagnose_and_fix`
  mistakenly read the new-properties total as a "save rate <10%" failure and
  spawned a recursive subprocess. The child died immediately on a DNS error
  and the parent completed cleanly, so no harm done — but the logic is
  fragile and worth tightening (see todo). The shell-side cleanup (pkill -9,
  trap-based pidfile removal) all behaved as designed.

## 2026-04-29 — Round 4: diff detection no longer depends on calendar date

### B-NEW3 fix(db): pick previous snapshot by sort order, not by calendar date
- **背景**: ユーザ指摘「前日との差分ではなく『前回の取得』との差分が筋」。実装は「`snapshot_date < today`」で日付ベースだったため、ジョブが連続失敗してスナップショットの日付に穴が空くと、`get_previous_links` が空リストを返す → 全件 new 扱い → 4,681 件全件スクレイプ → 2時間タイムアウト → 翌日のスナップショットも残らない、という**負のループ**を生んでいた。実際これが 4/25〜4/29 の 5 日連続失敗の主因の一つ（B-001 の checkpoint 破損と並ぶ）。
- **変更**:
  - `database.py` に `get_previous_snapshot_links(category)` を新設。`ORDER BY snapshot_date DESC, scraped_at DESC LIMIT 1 OFFSET 1` で「自分の最新を除いた最新」を取得。日付には依存しない。
  - `get_previous_links` を legacy alias として残置（`check_supabase.py` などの外部スクリプト互換）。`days_back` 引数は明示的に「ignored」と docstring 化。
  - `integrated_scraper.detect_diff` を新名に切り替え。
- **副作用チェック**:
  - 呼び出し元 grep: `integrated_scraper.py:1038` の1箇所のみ → 修正済。`check_supabase.py` の 2 箇所は alias 経由で動く（戻り値型・例外挙動とも不変）
  - スキーマ変更なし。Supabase migration も不要
  - SQLite 8 シナリオ実機テスト（`get_previous_snapshot_links` の単体・連続失敗復旧・同日上書き・カテゴリ独立性・legacy alias）すべてPASS
  - 復旧シナリオ: 7日間スナップショット欠損 → 8日目のジョブが正しく 7日前のスナップショットを「previous」として扱い、全件 new ではなく差分のみスクレイプすることを確認

### Verification: regression on running scrape
- 15:12 起動の手動ジョブは旧ロジックで `house: 4681 / 4681 件` を全件 new と誤判定し timeout に向かっていた。新ロジックなら同じ条件下でも `house: ~50件` 規模に収まるはず（4/27 のスナップショットがあれば）。次回 launchd 起動 (4/30 03:00) で実証される。

## 2026-04-29 — Round 3: post-fix verification & checkpoint recovery

### Manual checkpoint repair
- **動作**: 旧来の破損 checkpoint.json (line 17913 で Extra data) を `JSONDecoder.raw_decode` で先頭 1 オブジェクトだけ救出し、`.corrupt.YYYYMMDD_HHMMSS` に元ファイルを退避してから書き戻し。
- **影響**: 翌日からの load_checkpoint がエラー無く動く。今日付けでは無いので stale 判定→新規スタート（仕様通り）。
- **副作用チェック**: `python -c 'json.load(...)'` でバリデーション通過。退避ファイルは追跡しない（.gitignore の `output/` で除外）

### Verification: end-to-end smoke tests
- save/load same-day → expected URL set 復元
- corrupt → quarantine → empty set
- post-quarantine の新規書き込みが正常 JSON
- 4 スレッド × 100 件並行書き込みで JSON 破壊なし

### Verification: shell-side defenses
- pidfile が生存 PID を指している間は新ジョブ起動を拒否（ログに "Another scraper run is in progress"）
- 死んだ PID を指している場合は stale クリーンアップして続行
- check_scraper_health.sh が「直近の連続失敗 5 日 / 過去14日中 11日欠損」を正しく報告
