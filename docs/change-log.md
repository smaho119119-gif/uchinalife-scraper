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
