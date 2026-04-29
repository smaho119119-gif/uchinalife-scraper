# TODO — 残件・改善候補

## 高優先（次ラウンド）
- [ ] `except: pass` を logger.warning に置き換える（残り20箇所程度）
- [ ] `print()` を logging モジュールに統一（big change のため計画立案要）

## 中優先
- [ ] Supabase 経由のときに `_get_sqlite_connection` 互換のリトライを RPC 側にも整備
- [ ] launchd の RunAtLoad / 復帰時実行の運用判断（issues.md I-001）
- [ ] sales-dashboard 側のログ追跡（pendingで未調査）

## 低優先
- [ ] image_archiver の HTTP timeout / retry 強化
- [ ] tests/ ディレクトリの実行可能化
- [ ] CI（GitHub Actions）の dry-run 走らせる
