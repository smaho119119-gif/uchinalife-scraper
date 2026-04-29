# Open Issues — 未解決事項・懸念点

## I-001 launchd RunAtLoad / KeepAlive をどう扱うか
- 現状: 起動時実行や復帰時実行は設定なし
- 懸念: スリープ時間と 03:00 が重なると skip
- 後回し理由: 運用形態の確認が必要（毎晩開いているのか、closed lid + power adapter か）
- 追加調査: ユーザに確認 / `pmset -g sched` の運用の有無

## I-002 ログ出力に logger を使っていない
- 現状: print() 多用、ログレベル無し
- 懸念: 将来の解析難易度
- 後回し理由: 大規模リファクタが必要。本ラウンドのスコープ外
- 追加調査: 既存 print の grep 結果から logger 移行コストを見積

## I-003 沈黙する except: pass の網羅
- 現状: 25 箇所中、本ラウンドで対応したのは `save_checkpoint` / `database._get_property_by_url` 等のクリティカル系のみ
- 残件: `scrape_detail` 内の各個別フィールド取得 (~10 箇所) は「ベストエフォート」設計のため当面据え置き
- 後回し理由: フィールド毎に "取れなくても継続" が正しい挙動

## I-004 Supabase RLS / service_key の運用
- 現状: anon key で書き込み (database.py:49)
- 懸念: 書き込み権限の RLS が緩いと外部から書き込まれるリスク
- 後回し理由: 別タスク。今回のスクレイピング失敗とは独立
