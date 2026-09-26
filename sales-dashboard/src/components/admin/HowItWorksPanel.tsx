import { ExternalLink } from 'lucide-react';
import { Panel, SectionTitle } from '@/components/admin/admin-ui';

const STEPS: { title: string; body: string }[] = [
    {
        title: '1. 毎晩 03:17（日本時間）に GitHub Actions が起動',
        body: '8種類（住居・事業用・月極駐車場・時間貸駐車場・土地・マンション・戸建・その他）を8台で同時に集めます。ちょうど0分は GitHub が混んで遅れる・飛ばされるので17分にずらしています。それでも GitHub 側の都合で数時間遅れることがあります（取得履歴の「予定からの遅れ」）。',
    },
    {
        title: '2. 一覧はサイトの検索APIで取得',
        body: '市町村 → 地区の小分けで検索APIを呼び、サイトが返す件数と受け取った件数が一致するまで取り直します。一致しなかったカテゴリは「不完全」とし、そのカテゴリでは売れた判定をしません。APIが使えないときは一覧ページをめくる旧方式に自動で切り替わります。',
    },
    {
        title: '3. 売れた判定は慎重に',
        body: '前日にあって今日の一覧に無い物件は、詳細ページを開いて2回とも 404 のときだけ「売れた」にします。売れた扱いが全体の15%を超えたら異常とみなして書き込みを保留します。',
    },
    {
        title: '4. 保存と PROPERTY AI への同期',
        body: 'うちなーらいふDB（米国・共有）の properties と daily_link_snapshots に保存し、NextCode不動産の「AI相場推定」用に PROPERTY AI（東京）の市場データへ送ります。売れた物件の写真は最大3枚を小さくして保存します。',
    },
    {
        title: '5. 結果は必ず1通メール',
        body: '成否にかかわらず、東京の中継（Vercel）から info 宛てに1通送ります。GitHub（海外）から直接送ると XServer に拒否されるためです。実行の成績はこの画面の「取得履歴」にも1回1行で残ります。',
    },
];

export function HowItWorksPanel({ workflowUrl }: { workflowUrl: string }) {
    return (
        <div className="space-y-5">
            <Panel>
                <SectionTitle sub="この画面は読むだけです。実行・停止はここからはできません。">毎晩の取得の仕組み</SectionTitle>
                <ol className="space-y-4">
                    {STEPS.map((s) => (
                        <li key={s.title}>
                            <h3 className="text-base font-bold text-slate-900">{s.title}</h3>
                            <p className="mt-1 text-[15px] leading-relaxed text-slate-800">{s.body}</p>
                        </li>
                    ))}
                </ol>
            </Panel>
            <Panel>
                <SectionTitle>手動で動かすとき</SectionTitle>
                <p className="text-[15px] leading-relaxed text-slate-800">
                    GitHub Actions の画面で「Run workflow」を押します。mode は full（本番）/ collect-only（集めるだけ・DBに書かない）/ mail-test（メールだけ試す）、売れた判定は normal / dry-run / cleanup / skip から選べます。
                </p>
                <a
                    href={workflowUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-3 inline-flex items-center gap-2 rounded-lg bg-teal-700 px-4 py-2.5 text-[15px] font-semibold text-white shadow hover:bg-teal-800"
                >
                    GitHub Actions を開く <ExternalLink className="h-4 w-4" aria-hidden="true" />
                </a>
                <p className="mt-3 text-[15px] text-slate-600">鍵（DB・メール・同期の合言葉）は GitHub の Secrets と Vercel の環境変数にだけ置いています。この画面には出しません。</p>
            </Panel>
        </div>
    );
}
