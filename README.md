# うちなーらいふ 物件収集

e-uchina.net（うちなーらいふ）の掲載物件を毎晩集め、新着・売れた物件を記録して、結果をメールで送る。
Mac では動かさない。**GitHub Actions だけ**で動く。

## いつ・どこで動くか

- 毎日 **03:17 JST**（`.github/workflows/scrape-parallel.yml` の cron `17 18 * * *`）。00分ちょうどは GitHub が混んで実行が飛ぶのでずらしている
- 8種類（jukyo / jigyo / yard / parking / tochi / mansion / house / sonota）を **8台で同時に**集める。全体で約8分
- 結果は成否にかかわらず**必ず1通**メールで届く（宛先は Secrets の `ALERT_TO`）

手動で動かすとき（Actions 画面の Run workflow）:

| 項目 | 選択肢 | 意味 |
|---|---|---|
| mode | `full`（既定） | 収集＋DB保存＋メール |
| | `collect-only` | 集めるだけ（DBは書かない） |
| | `mail-test` | メールが届くかだけ試す |
| sold_mode | `normal`（既定） | 売れた判定をする |
| | `dry-run` | 判定するが書き込まない |
| | `cleanup` | 誤って売れた扱いにした物件を戻す |
| | `skip` | 売れた判定をしない |

## 仕組み

1. **一覧の取得** `api_collect.py` — サイトの検索API `/api/search` を「市町村 → 地区」の小分けで呼ぶ。サイトが返す件数と受け取った件数が一致するまで取り直し、一致しなければそのカテゴリは「不完全」とする。APIが使えないときはブラウザで一覧ページをめくる方式に自動で切り替わる
2. **新着・売れた判定** `integrated_scraper.py` ＋ `sold_confirm.py` — 前日にあって今日無い物件は、詳細ページが **2回とも 404** のときだけ「売れた」にする。不完全なカテゴリでは判定しない。売れた扱いが全体の15%を超えたら異常とみなして止める
3. **保存** `database.py` — Supabase（`properties` / `daily_link_snapshots`）
4. **PROPERTY AI へ同期** `market_sync.py` — NextCode不動産の「AI相場推定」用に、東京の Supabase の `property_ai_market_*` へ送る
5. **メール** `actions_report.py` → `html_report.py` / `daily_report.py` → `notify_failure.py` — HTMLのレポートを作り、`mail-relay/`（Vercel 東京）経由で送る。XServer の SMTP は GitHub（海外IP）からの送信を 554 で拒否するため中継している

`image_archiver.py` は物件画像の保存、`config.py` は設定。

`geo_near.py` は海・ゆいレール駅・小学校までの**直線距離**を出す（Google の API は使わない）。参照データ `geo/okinawa_ref.json.gz` は `tools/build_geo_ref.py` で作る。
出典: 海岸線・小学校＝国土地理院ベクトルタイル（国土地理院ウェブサイト・公共データ利用規約 第1.0版）／駅＝国土数値情報 鉄道データ N02-23（国土交通省・CC BY 4.0）。
国土数値情報の海岸線 C23・学校 P29 は「非商用」なので使っていない。

## 鍵

鍵は **GitHub の Secrets にだけ**置く（このリポジトリは公開）。コードやファイルに書かない。
必要な名前は `.env.example` を参照。

## 手元で試すとき

```bash
python3 -m venv venv && venv/bin/pip install -r requirements.txt
venv/bin/python api_collect.py tochi          # 土地の一覧をAPIで取れるか
```

`requirements.txt` は numpy 2 系で pandas が壊れた事故があるので版を固定している。
