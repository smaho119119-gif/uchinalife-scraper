# TODO — 残件・改善候補

## 高優先（次ラウンド）
- [ ] `except: pass` を logger.warning に置き換える（残り20箇所程度）
- [ ] `print()` を logging モジュールに統一（big change のため計画立案要）
- [ ] B-NEW3: `get_previous_links` の `days_back` 引数を実装するか、命名を実態に合わせる
- [ ] B-NEW4: 進捗表示の刻み判定を「前回 +10 超えたら」式に
- [ ] B-NEW5: scrape_detail の try/except を `_safe_get_text` ヘルパへ集約

## 中優先
- [ ] Supabase 経由のときに `_get_sqlite_connection` 互換のリトライを RPC 側にも整備
- [ ] launchd の RunAtLoad / 復帰時実行の運用判断（issues.md I-001）
- [ ] sales-dashboard 側のログ追跡（pendingで未調査）

## 低優先
- [ ] image_archiver の HTTP timeout / retry 強化
- [ ] tests/ ディレクトリの実行可能化
- [ ] CI（GitHub Actions）の dry-run 走らせる
