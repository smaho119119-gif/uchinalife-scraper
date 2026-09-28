# うちなーらいふ 物件収集

e-uchina.net（うちなーらいふ）の掲載物件を毎晩集め、新着・売れた物件を記録して、結果をメールで送る。
Mac では動かさない。**GitHub Actions だけ**で動く。

## いつ・どこで動くか

- 毎日 **03:17 JST**（`.github/workflows/scrape-parallel.yml` の cron `17 18 * * *`）。00分ちょうどは GitHub が混んで実行が飛ぶのでずらしている。ただし GitHub の混雑で実際の開始は遅れる（2026-09-26〜28 の実測は 06:11〜06:35 JST 開始・約20分）
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
5. **公開サイトの作り直し** `site_refresh.py` — 本番（full）の回だけ。fudosan.nextcode.ltd の作り置きを消し、全ページと地図APIを開いて、合図より後に作られた版になったかを確かめる（下の「公開サイトの作り直し」）
6. **メール** `actions_report.py` → `html_report.py` / `daily_report.py` → `notify_failure.py` — HTMLのレポートを作り、`mail-relay/`（Vercel 東京）経由で送る。XServer の SMTP は GitHub（海外IP）からの送信を 554 で拒否するため中継している
7. **実行の記録** `run_log.py` — 各台の時刻・件数・メールと公開サイトの結果を DB（`uchina_scrape_runs`）に残す。管理ページ home-sales.nextcode.ltd/admin の「取得履歴」に出る

`image_archiver.py` は物件画像の保存、`config.py` は設定。

`geo_near.py` は海・ゆいレール駅・小学校までの**直線距離**を出す（Google の API は使わない）。参照データ `geo/okinawa_ref.json.gz` は `tools/build_geo_ref.py` で作る。
出典: 海岸線・小学校＝国土地理院ベクトルタイル（国土地理院ウェブサイト・公共データ利用規約 第1.0版）／駅＝国土数値情報 鉄道データ N02-23（国土交通省・CC BY 4.0）。
国土数値情報の海岸線 C23・学校 P29 は「非商用」なので使っていない。

## 公開サイトの作り直し

fudosan.nextcode.ltd（NextCode不動産の `web/`）はページとデータを1時間作り置きする。作り直しは「1時間たったあとに誰かが開いた時」なので、見に来る人が少ないと何日も前の版が残る。そこで毎晩（本番 full の回だけ）、同期のあとに `site_refresh.py` が次を行う（所要 30〜60秒、締め切り150秒、工程は4分で打ち切り）。

1. `POST /api/revalidate`（合言葉つき）で相場データの作り置きを全部消す
2. トップ・/sagasu・テーマ9ページ・地図API 9本を開く
3. 合図より後に作られた版かを確かめる（応答の `age`、地図APIの `at` と `asOf`、ページの「<日付> 更新」、トップの「<日付>時点」）。消した直後はまだ古い版が返ることがある（9/28 の通しの実行では1〜3周でそろった）ので、そろうまで10秒おきに開き直す

結果は `logs/site_refresh.json`。問題があれば日報の状態欄と管理ページに「公開サイトの作り直しで問題（収集とは別）」の1行が出る。

| 出た文言 | 意味 | 対処 |
|---|---|---|
| 合言葉が一致しない | Vercel の `REVALIDATE_TOKEN` と GitHub Secret `FUDOSAN_REVALIDATE_TOKEN` が違う（Vercel 側が未設定でも同じ） | 下の「合言葉の入れ替え」で両方を同じ値に（手元で流しても次の夜にまた落ちる） |
| 合言葉が未設定 | GitHub Secret が無い | 控え `~/.claude/secrets/uchinalife/revalidate_token` の値（Vercel の `REVALIDATE_TOKEN` と同じ）を Settings → Secrets and variables → Actions に `FUDOSAN_REVALIDATE_TOKEN` として登録 |
| サイトに合図の入口が無い | サイトを古い版に戻した | NextCode不動産の `web/app/api/revalidate` があるか確認 |
| 古い版のまま・更新日が古いまま・地図のデータが古いまま | 締め切りまでに新しい版にならなかった | 手元で `python3 site_refresh.py` |
| データを読み込めなかった版・サイト側の障害・日付を確かめられなかった | 相場API（Supabase）か Vercel の障害 | 障害が収まってから手元で `python3 site_refresh.py` |
| 途中で打ち切られた | 4分を超えた（どこかで応答が止まった） | 手元で `python3 site_refresh.py` |

- 対処で GitHub の report ジョブを再実行しないこと（日報がもう1通届き、実行記録も上書きされる）
- 前の日の版は、次に誰かが開いたときに作り直される。相場APIの障害中は直らない
- 手元で試す: `python3 site_refresh.py`（環境変数が無ければ `~/.claude/secrets/uchinalife/revalidate_token` を読む）。本番の作り置きを実際に消して作り直す。害は無い
- 今サイトが新しいかだけ見る: `curl -sD- -o /dev/null https://fudosan.nextcode.ltd/sagasu/umi | grep -iE "^age|x-vercel-cache"`（age が作り直しからの秒数以下なら新しい）
- 自動テスト: `python3 -m unittest tests/test_site_refresh.py`

**合言葉の入れ替え**（どちらの順でも、Vercel の出し直しと GitHub Secret の変更の間は一致しない。**定期実行（GitHub の混雑で実際は朝6時台に始まる）と重ならない昼間に、続けて全部やる**）

1. 新しい値を作る: `python3 -c "import secrets;print(secrets.token_urlsafe(32))"`
2. Vercel（プロジェクト `nextcode-property-ai`・Production）の `REVALIDATE_TOKEN` を変える: **NextCode不動産のリポジトリ直下で**（Vercel との紐付け `.vercel/project.json` は直下にだけある。Root Directory は web）`npx vercel env rm REVALIDATE_TOKEN production` → `npx vercel env add REVALIDATE_TOKEN production`（値を貼る）
3. 本番を出し直す（変えた値は出し直すまで効かない）: main に空コミットを push（`git commit --allow-empty -m "合言葉を入れ替えたので出し直し" && git push`）。相場APIが止まっているとビルドが失敗するので、その時は復旧を待つ
4. GitHub Secret `FUDOSAN_REVALIDATE_TOKEN` を同じ値に（`gh secret set FUDOSAN_REVALIDATE_TOKEN -R smaho119119-gif/uchinalife-scraper`）
5. 控え `~/.claude/secrets/uchinalife/revalidate_token` を同じ値に
6. `python3 site_refresh.py` で「作り直し完了」を確かめる

## 鍵

鍵は **GitHub の Secrets にだけ**置く（このリポジトリは公開）。コードやファイルに書かない。
必要な名前は `.env.example` を参照。

## 手元で試すとき

```bash
python3 -m venv venv && venv/bin/pip install -r requirements.txt
venv/bin/python api_collect.py tochi          # 土地の一覧をAPIで取れるか
```

`requirements.txt` は numpy 2 系で pandas が壊れた事故があるので版を固定している。
