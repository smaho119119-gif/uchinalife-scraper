# Bug List — うちなーらいふスクレイピング

監査開始: 2026-04-29
最終更新: 2026-04-29

## 凡例
- 優先度: **重大** = データロス/サービス停止 / **中** = 機能低下・運用負担 / **軽微** = 体験劣化のみ
- 状況: 未対応 / 対応中 / 修正済 / 再検証待ち / 完了

---

## B-001 [重大] checkpoint.json が壊れて進捗保存が全失敗

- **症状**: scraper.log に `Error saving checkpoint: Extra data: line 17913 column 8` が913回出力。チェックポイントが11/27時点から更新されない。
- **再現条件**: 並行スレッド (MAX_WORKERS=2) が10件ごとに `save_checkpoint()` を同時呼び出しすると JSON が壊れる。
- **原因候補**: ファイル書き込みのスレッドロック無し / 非アトミック書き込み
- **根本原因**: [integrated_scraper.py:476-494](../integrated_scraper.py#L476-L494) `save_checkpoint` が read→modify→write をロックなし・非アトミックで行っている。並行書き込みでファイルが破壊される。
- **影響範囲**: 進捗保存無効 → 毎日全件再スクレイプ → 2時間タイムアウト → サービス事実停止（5日連続失敗）
- **優先度**: 重大
- **対応方針**: ① 既存破損ファイルを削除/修復 ② スレッドロック追加 ③ 一時ファイル経由のアトミック書き込み（os.replace）
- **状況**: 修正済 (commit `fix(scraper): atomic & thread-safe checkpoint write`)

## B-002 [重大] SIGTERMでプロセスが死なない（暴走化）

- **症状**: gtimeout 7200秒で SIGTERM が送られても python が死なず、29時間動き続けたケースを検出。
- **再現条件**: 2時間タイムアウト到達時に SIGTERM 受信。シグナルハンドラ内で Playwright `browser.close()` がデッドロック。
- **原因候補**: シグナルハンドラからスレッドのリソース解放を試みている / GIL+Playwright threadingで詰まる
- **根本原因**: [integrated_scraper.py:137-141](../integrated_scraper.py#L137-L141) `_signal_handler` が `_cleanup_all_browsers()` を呼び、ロック取得→browser.close()。Playwrightは別スレッド前提のためメインスレッドからの close 待ちが帰ってこない。
- **影響範囲**: ジョブが終わらないまま launchd の次回実行をブロック → 連日失敗
- **優先度**: 重大
- **対応方針**: シグナルハンドラから browser.close() を排除し、即 sys.exit() する。クリーンアップは shell 側 pkill -9 と gtimeout --kill-after に任せる。run_daily_scraper.sh は対応済み。
- **状況**: 修正済 (commit `fix(scraper): make signal handler non-blocking`)

## B-003 [重大] gtimeout の SIGKILL フォールバックが無い

- **症状**: SIGTERM が無視されると gtimeout は永久待ち（プロセス kill されない）
- **根本原因**: `gtimeout 7200 ...` のみ。`--kill-after` を指定していなかった。
- **影響範囲**: B-002 と複合してジョブ暴走
- **優先度**: 重大
- **対応方針**: `gtimeout --kill-after=300 7200` で SIGTERM 5分後に SIGKILL 強制
- **状況**: 修正済 (前回セッションの commit)

## B-004 [中] sqlite3 接続が check_same_thread デフォルトのままマルチスレッド利用

- **症状**: 顕在化は無いが、`db.upsert_property()` がメインスレッドから ThreadPoolExecutor の future 完了通知後に呼ばれる構造。複数スレッドから同時呼出される将来リスク。
- **根本原因**: [database.py:111-113](../database.py#L111-L113) `_get_sqlite_connection` がスレッドごとに新規接続を返すので現状は安全だが、SQLiteファイルロック競合は起きうる。
- **影響範囲**: 将来の並行アクセスでの "database is locked" 例外、データ取りこぼし
- **優先度**: 中
- **対応方針**: 接続 pragma `busy_timeout=30000` を設定。ロックリトライを `_get_sqlite_connection` に組み込む。
- **状況**: 修正済 (commit `fix(db): set sqlite busy_timeout to avoid lock failures`)

## B-005 [中] check_scraper_health.sh の連続失敗カウントが誤検出

- **症状**: ヘルスチェックが「3日連続失敗」と表示する一方、実際の連続失敗日数と一致しない場合がある。
- **再現条件**: 過去日のmarkerに穴（A日成功・B日失敗・今日失敗）が混在するとカウントが破綻。
- **根本原因**: [check_scraper_health.sh:34-42](../check_scraper_health.sh#L34-L42) は「今日から遡って最初に成功した日まで」しか数えない。1日でも成功markerがあれば break → 過去の長期失敗を過小評価。
- **影響範囲**: アラートが弱まり、長期障害に気付くのが遅れる
- **優先度**: 中
- **対応方針**: 「今日から遡って何日成功 marker が無いか（=直近の連続失敗）」のロジックを正規化。
- **状況**: 修正済 (commit `fix(health): correct consecutive failure counting`)

## B-006 [中] ジョブ重複防止に stale lock 検出が無い

- **症状**: 前回ジョブが暴走中（marker未生成・プロセス生存）でも、launchd は marker チェックだけで重複起動を試みる
- **根本原因**: [run_daily_scraper.sh:20-23](../run_daily_scraper.sh#L20-L23) は `success_*.marker` のみチェック。実行中のロックが無い。
- **影響範囲**: 暴走中に新規ジョブが起動 → 二重実行 → リソース競合
- **優先度**: 中
- **対応方針**: `flock` 風の pidfile lock を導入。pidfile 存在 + プロセス生存なら exit 0、stale なら掃除して継続。
- **状況**: 修正済 (commit `fix(launchd): pidfile lock prevents duplicate runs`)

## B-007 [中] sales-dashboard/scraper.log が膨れて肥大化

- **症状**: scraper.log が 318KB（同じcheckpointエラーで埋まる）
- **根本原因**: launchd の StandardOutPath で append のみ。ログローテートが無い。
- **影響範囲**: ディスク使用量増加 / 過去ログ取り回しが重い
- **優先度**: 中
- **対応方針**: run_daily_scraper.sh の冒頭でログサイズが10MB超なら `mv` で日付付きアーカイブ
- **状況**: 修正済 (commit `chore(launchd): rotate scraper logs when oversized`)

## B-008 [軽微] 沈黙する `except: pass` が多数

- **症状**: 25 箇所で `except: pass` か `except: continue`。失敗が観測できない。
- **根本原因**: 個別の catch にロギング無し。原因究明時に何が起きたか分からない。
- **影響範囲**: 障害解析の難易度
- **優先度**: 軽微（ただし B-001 は失敗を握りつぶす類の問題と関連）
- **対応方針**: 重大箇所（IO・DB・ネットワーク）は logger.warning に置き換え。本ラウンドでは save_checkpoint と database のみ実施。残りは todo に記録。
- **状況**: 部分対応 (todo.md に残件記録)

## B-009 [軽微] MAX_BROWSER_USES=50 で頻繁な browser 再生成が Chromium ゾンビを生む

- **症状**: pkill -f chromium がスクリプト末尾に置かれている事自体が、ゾンビ前提の運用を物語る
- **根本原因**: [integrated_scraper.py:181-211](../integrated_scraper.py#L181-L211) で 50 リクエスト毎に browser 全 close→launch。close 失敗時に Chromium が残る。
- **影響範囲**: メモリ膨張・残存プロセス
- **優先度**: 軽微
- **対応方針**: 値を引き上げ（200）してリブート頻度を下げる + close失敗時に PID kill フォールバック
- **状況**: 修正済 (commit `refactor(scraper): reduce browser restart churn`)

## B-NEW1 [中] auto_diagnose_and_fix が gtimeout 管理外で subprocess 起動

- **症状**: 再試行のための `subprocess.run([python, script_path, ...])` が gtimeout の親 PID 木の外で動く可能性。
- **根本原因**: [integrated_scraper.py:1109](../integrated_scraper.py#L1109) で `subprocess.run` を直接叩く。
- **影響範囲**: 親が SIGTERM/SIGKILL を受けた瞬間に子は孤児化し得るが、`run_daily_scraper.sh` 末尾の `pkill -9 -f integrated_scraper.py` が確実に掃除するため実害は最小。
- **優先度**: 中 → 軽微（Round 1 のシェル側 pkill が緩和済み）
- **対応方針**: 現状維持。decisions.md D-007 に記載。再発時は本格対応。
- **状況**: 緩和済み（コード変更なし、運用判断）

## B-NEW3 [軽微→中] get_previous_links の days_back 引数が無視 / 日付ベース検出が脆弱

- **症状**:
  1. 引数 `days_back: int = 1` を受けるが、実装は単に `snapshot_date < today` で最新1件を返すのみ。指定値が反映されない。
  2. **より深刻**: 連続失敗で前日スナップショットが欠損すると `[]` 返却 → 全件 new 扱い → 全件再スクレイプ → またタイムアウト → 翌日もスナップショット無し → **負のループ**。今回の障害連鎖の主因の一つ（B-001 と並ぶ）。
- **根本原因**: [database.py:294-323](../database.py#L294-L323) は「日付ベース」で「直前の取得」を表現しようとしていたため、日付に穴が空くと壊れる。
- **影響範囲**: 1日でも失敗すると翌日のジョブが2時間タイムアウト確定 → 連鎖
- **優先度**: 中（実害大、修正コスト小）
- **対応方針**: 「snapshot_date < today」ではなく「**現在のレコードの直前のレコード**」を ORDER BY + OFFSET 1 で取る。日付に依存しない。
- **状況**: 修正済 (commit `fix(db): pick previous snapshot by sort order, not by calendar date`)

## B-NEW4 [軽微] 進捗表示の `% 10 == 0` 判定が誤ヒット

- **症状**: scraped_count + error_count == 1340 で error が 1 出ると 1341 になり 10 件単位で揃わない。
- **根本原因**: [integrated_scraper.py:1340-1341](../integrated_scraper.py#L1340-L1341) で `(scraped_count + error_count) % 10 == 0` のみ判定。
- **影響範囲**: ログの読みやすさのみ。
- **優先度**: 軽微
- **対応方針**: 「合計が10刻みではなく、合計が前回出力時点+10超えたら出す」ロジックに変更。todo.md
- **状況**: 未対応 (todo.md)

## B-NEW5 [軽微] scrape_detail 内に try/except のテンプレ重複

- **症状**: 各フィールド取得が同じ「`try: 取得; except: data[k] = ""`」を繰り返している。
- **根本原因**: ヘルパー抽出されていない。意図は「ベストエフォート」で例外時は空。
- **影響範囲**: 保守性。バグ予備軍ではない。
- **優先度**: 軽微
- **対応方針**: `_safe_get_text(page, selector)` ヘルパに抽出。今回スコープ外。todo.md
- **状況**: 未対応 (todo.md)

## B-NEW2 [中] 閉じた browser context を返してしまうレース

- **症状**: scraper.log に `Target page, context or browser has been closed` が混入。
- **再現条件**: `MAX_BROWSER_USES` 到達時に `get_thread_browser` が context を None リセットするが、別スレッドが同時に古い `_thread_local` を参照していると無効化が遅れる。あるいは別経路で context が close された場合に検出できない。
- **根本原因**: [integrated_scraper.py:222-228](../integrated_scraper.py#L222-L228) の旧 `get_thread_context()` は `is None` チェックのみで、closed-but-not-None を検出しない。
- **影響範囲**: `scrape_detail` の `context.new_page()` 失敗 → 当該URLのみエラー。Errors カウンタには載るが checkpoint は更新される。
- **優先度**: 中
- **対応方針**: `get_thread_context` でアクセス試行による生存確認を実施。closed なら再生成。
- **状況**: 修正済 (Round 2 commit `fix(scraper): rebuild browser context when closed`)

## B-010 [軽微] launchd plist の StartCalendarInterval が単発（バックフィル無し）

- **症状**: Mac がスリープしていると 03:00 のジョブが skip される
- **根本原因**: plist に `StartCalendarInterval` のみで `RunAtLoad` も他のリトライ機構も無い
- **影響範囲**: ノートPCを夜閉じている運用では取りこぼし
- **優先度**: 軽微（運用形態による）
- **対応方針**: 初回ロード時/復帰時にも実行されるよう設定追加 → ただし twice実行を防ぐため marker check が effective
- **状況**: 未対応（todo.md）
