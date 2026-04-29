# Decisions — 修正方針・設計判断

## D-001 シグナルハンドラからリソース解放を排除
- **決定**: `_signal_handler` は `print` + `sys.exit(1)` のみ。browser.close() を呼ばない。
- **理由**: Playwright の同期APIは別スレッド + GIL 状態で signal 経由の close がデッドロックする実例があった（B-002）。
- **代替案不採用**: 「ハンドラから別スレッドにcloseを投げる」案 → タイムアウト保証が無く再現する可能性
- **副次対策**: shell 側 `gtimeout --kill-after=300` で SIGKILL 強制、`pkill -9 -f chromium` でゾンビ掃除

## D-002 checkpoint 書き込みはアトミック + ロック
- **決定**: `save_checkpoint` を threading.Lock + `os.replace(tmp, dst)` で実装
- **理由**: 並行スレッドからの read-modify-write を直列化しないと JSON が確実に壊れる。一度壊れると沈黙して進捗保存が永久停止する（B-001）。
- **代替案不採用**: 「DBに checkpoint を保存」案 → 既存ファイル運用との互換性を保つため見送り。将来的に検討

## D-003 ヘルスチェックは「直近の連続失敗日数」を正しく数える
- **決定**: 過去 14日を走査し、最初に当たる success marker までの距離を「連続失敗」とする
- **理由**: 旧実装は break が早すぎて長期障害を過小評価していた（B-005）

## D-004 PID lock でジョブの二重実行を防ぐ
- **決定**: `run_daily_scraper.sh` 冒頭で `pidfile` を作成。既存 pidfile があり、そのプロセスが生存していれば exit 0。死亡 stale なら掃除して続行。
- **理由**: marker は成功時しか作られないため「実行中」を示せない。ジョブが暴走中でも launchd は再実行を試みるリスク（B-006）。

## D-005 ログローテーション最小実装
- **決定**: scraper.log が 10MB 超で `mv scraper.log scraper.log.YYYYMMDD` する
- **理由**: launchd の append-only で肥大化を抑える簡素な手段（B-007）

## D-007 auto_diagnose_and_fix の再帰 subprocess は維持

- **決定**: 既存の `subprocess.run([python, script_path, "--skip-refresh"])` 形態を維持。shell 経由（pidfile lock 通過）には変更しない。
- **理由**: Round 1 の `run_daily_scraper.sh` の末尾 `pkill -9 -f integrated_scraper.py` が孤児を確実に掃除する。再帰は `AUTO_RETRY_COUNT` で 2 回までに制限。実害は観測されていない。
- **代替案不採用**: 「shell 経由で再起動」案 → pidfile lock を壊すか、bypass フラグを増やす副作用が出る

## D-009 「直前の取得」を日付ではなく ORDER BY OFFSET 1 で表現

- **決定**: `daily_link_snapshots` のスキーマは変更せず、`get_previous_snapshot_links` で `ORDER BY snapshot_date DESC, scraped_at DESC LIMIT 1 OFFSET 1` により「自分の最新を除いた最新」を取る。`get_previous_links` は legacy alias として残置（外部診断スクリプト互換）。
- **理由**: 旧設計は「昨日のスナップショット」を `snapshot_date < today` で取りに行くため、1日でも失敗するとスナップショットの穴で「該当無し → 全件 new」 → 全件再スクレイプ → タイムアウト → さらに穴を増やす負のループ。OFFSET 1 にすれば日付の穴を自然にスキップする。
- **代替案不採用**:
  - **B案 (履歴化スキーマ)**: PRIMARY KEY を id にして同日複数行許容。「直前の取得」をジョブ粒度で正確に取れるが、Supabase migration 必要 + 既存データの整合考慮で実装コスト大。同日複数回起動は通常運用でゼロ → A案で十分。
  - **C案 (DB の properties テーブルから直接 active な URL 集合を取る)**: 真実のソースを DB に統一する案。クエリは安いが「最後にスクレイプされたかどうか」と「リスト上に存在するかどうか」が混ざるため意味が変わる。今回は変更スコープ外。
- **副次効果**: 同日2回目に手動起動すると、OFFSET 1 で「**昨日**」を取る（朝の自分自身ではなく）。1日1回の通常運用では完全に同等。同日連打は通常起きないので許容。

## D-008 get_thread_context の生存確認

- **決定**: closed-but-not-None な context をプロパティアクセスで検出して再生成。
- **理由**: B-NEW2 の修復。1リクエストあたり 1回のチェックなので性能影響は無視できる。
- **代替案不採用**: 「new_page を try-except で囲む」案 → 失敗時のリカバリ箇所が分散するため、入口で一括判定する方が読みやすい

## D-006 並列度・リブート頻度のチューニング
- **決定**: MAX_BROWSER_USES のデフォルトを 50 → 200。ただし環境変数で上書き可能のまま。
- **理由**: close→launch の往復回数を1/4に減らし Chromium ゾンビ生成リスクを低減（B-009）。挙動変化は安全側（少ないリブート）。
