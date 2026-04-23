/**
 * Image-generation prompt builders for property "提案書" (proposal) layouts.
 *
 * Goal of this extraction: keep `lib/ai.ts` focused on Gemini SDK plumbing
 * and surface the actual prompt strings for review/A-B-testing in one place.
 * Output strings are intentionally byte-identical to the previous inline
 * version so that AI generations stay reproducible.
 */

import type { PropertyDetails } from '@/prompts/property-fields';

export type ProposalTemplateType = 'card' | 'compare' | 'flow' | 'grid';

interface BuildProposalPromptInput {
    template: ProposalTemplateType;
    propertyDetails: PropertyDetails;
    propertyImageCount: number;
    hasStaffPhoto: boolean;
    aspectRatio: string;
}

function buildLayoutCard(d: PropertyDetails): string {
    return `
【物件カードレイアウト】名刺サイズの物件紹介カード

┌────────────────────────────────────────┐
│  ┌─────────────┐                       │
│  │             │  🏠 ${d.title}   │
│  │  物件写真    │  ─────────────────────│
│  │   (大)      │  💰 ${d.price}    │
│  │             │                       │
│  └─────────────┘  📍 ${d.address} │
│                                        │
│  ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐     │
│  │🏠    │ │🚗   │ │🐕   │ │🔐   │     │
│  │間取り│ │駐車場│ │ペット│ │セキュリ│     │
│  └─────┘ └─────┘ └─────┘ └─────┘     │
│                                        │
│  🏢 ${d.company}         │
│  📞 お問い合わせ ▶                     │
└────────────────────────────────────────┘

- シンプルで見やすいカードデザイン
- 物件写真を左上に大きく配置
- 主要情報を右側に
- 設備はアイコン形式で下部に並べる`;
}

function buildLayoutCompare(d: PropertyDetails): string {
    return `
【比較表付きレイアウト】費用内訳が一目で分かる

┌────────────────────────────────────────┐
│  🏠 ${d.title}                     │
│  ★★★ ${d.price} ★★★              │
├────────────────────────────────────────┤
│  ┌─────────────────┐  ┌────────────────┐│
│  │                 │  │ 📊 費用詳細    ││
│  │    物件写真     │  │ ┌────┬────┐   ││
│  │                 │  │ │敷金│○○○│   ││
│  │                 │  │ ├────┼────┤   ││
│  │                 │  │ │礼金│○○○│   ││
│  └─────────────────┘  │ ├────┼────┤   ││
│                       │ │仲介│○○○│   ││
│  📍 ${d.address}  │ └────┴────┘   ││
│  🏠 ${d.layout}   └────────────────┘│
│  🚗 ${d.parking}                    │
├────────────────────────────────────────┤
│  🏢 ${d.company} │ 📞 お問い合わせ │
└────────────────────────────────────────┘

- 右側に費用比較表
- 初期費用の合計も表示
- 数字は見やすく大きめに`;
}

function buildLayoutFlow(d: PropertyDetails): string {
    return `
【フロー型レイアウト】情報を段階的に表示

        ${d.title}
              ↓
┌────────────────────────────────────────┐
│          💰 ${d.price}             │
│          （最重要・最大サイズ）                  │
└────────────────────────────────────────┘
              ↓
┌──────────┐    ┌──────────┐    ┌──────────┐
│ 📍所在地  │ → │ 🏠間取り  │ → │ 🚗駐車場  │
│ ${d.address} │    │ ${d.layout} │    │ ${d.parking} │
└──────────┘    └──────────┘    └──────────┘
              ↓
┌────────────────────────────────────────┐
│  設備: 🔐 セキュリティ │ 🛁 バス │ 🍳 キッチン │
└────────────────────────────────────────┘
              ↓
┌────────────────────────────────────────┐
│  🏢 ${d.company}                  │
│  📞 お問い合わせはこちら →                      │
└────────────────────────────────────────┘

- 矢印で情報の流れを表現
- 上から下へ読み進める構造
- 各セクションは明確に区切る`;
}

function buildLayoutGrid(d: PropertyDetails): string {
    return `
【グリッド型レイアウト】情報を整然と配置

┌──────────────┬──────────────┬──────────────┐
│              │              │              │
│   物件写真1   │   物件写真2   │   物件写真3   │
│              │              │              │
├──────────────┴──────────────┴──────────────┤
│  🏠 ${d.title}                    │
│  💰 ${d.price}                     │
├──────────────┬──────────────┬──────────────┤
│ 📍所在地      │ 🏠間取り      │ 🚗駐車場      │
│ ${d.address} │ ${d.layout} │ ${d.parking} │
├──────────────┼──────────────┼──────────────┤
│ 🐕ペット      │ 🔐セキュリティ │ 💴敷金/礼金   │
│ ${d.pet} │ ${d.security} │ ${d.deposit} │
├──────────────┴──────────────┴──────────────┤
│  🏢 ${d.company} 📞 お問い合わせ  │
└────────────────────────────────────────────┘

- 3カラムのグリッドレイアウト
- 上部に写真ギャラリー
- 下部に情報グリッド
- 整然とした印象`;
}

function buildLayoutInstructions(template: ProposalTemplateType, d: PropertyDetails): string {
    switch (template) {
        case 'card':
            return buildLayoutCard(d);
        case 'compare':
            return buildLayoutCompare(d);
        case 'flow':
            return buildLayoutFlow(d);
        case 'grid':
            return buildLayoutGrid(d);
        default:
            return '';
    }
}

const STAFF_INSTRUCTIONS = `
════════════════════════════════════════════════════════
【スタッフ写真の加工・配置 - 重要】
════════════════════════════════════════════════════════
提供されたスタッフ写真を以下のように加工・配置してください：

■ ポーズ・雰囲気の加工（必須）
- スタッフが「物件を案内している」雰囲気に加工
- 手を物件写真に向けて差し出し、案内しているポーズに変更
- 明るい笑顔で親しみやすい表情に（必ず笑顔にする）
- 歯を見せた自然な笑顔が望ましい
- 不動産営業スタッフとして物件を紹介しているような自然なポーズ

■ 配置
- 右下に配置（全体の20-25%程度のサイズ）
- 円形の白い枠で囲む
- スタッフの上半身が見えるサイズ
- 背景と区別できるよう白い縁取りを追加

■ 案内ポーズの例
- 片手を物件写真の方向に伸ばし、「こちらの物件です」と案内しているポーズ
- もしくは両手を広げて物件全体を紹介するポーズ
- 親しみやすい明るい笑顔で（必ず笑顔）

【吹き出しコメント - AIで生成】
物件の特徴を分析して、魅力的な一言コメントを日本語で生成してください。
例：
- 駐車場が広い場合 →「駐車場広々！」
- ペット可の場合 →「ペットOK！」
- 価格がお得な場合 →「お得な物件！」
- 立地が良い場合 →「便利な立地！」
- 間取りが広い場合 →「広々空間！」
- 新築・築浅の場合 →「きれいな物件！」
- セキュリティ充実 →「安心のセキュリティ！」

物件データを見て、最も魅力的なポイントを短い日本語（10文字以内）で表現してください。
`;

function buildMultiImageInstructions(count: number): string {
    if (count <= 1) return '';
    return `
════════════════════════════════════════════════════════
【複数画像の使用 - 重要】
════════════════════════════════════════════════════════
提供された${count}枚の物件写真を全て使用してください。
- メイン写真を大きく配置
- サブ写真を小さく複数配置（コラージュ風またはギャラリー風）
- 全ての写真が見えるようにレイアウト
`;
}

export function buildProposalImagePrompt(input: BuildProposalPromptInput): string {
    const { template, propertyDetails: d, propertyImageCount, hasStaffPhoto, aspectRatio } = input;

    const layoutInstructions = buildLayoutInstructions(template, d);
    const staffInstructions = hasStaffPhoto ? STAFF_INSTRUCTIONS : '';
    const multiImageInstructions = buildMultiImageInstructions(propertyImageCount);

    return `
日本語の不動産提案書用インフォグラフィックを作成してください。
ビジネス提案書や紙資料に使える、プロフェッショナルなデザインです。
${hasStaffPhoto ? 'スタッフが物件を紹介するスタイルで作成してください。' : ''}

════════════════════════════════════════════════════════
【物件データ】
════════════════════════════════════════════════════════
物件名: ${d.title}
家賃: ${d.price}
敷金/礼金: ${d.deposit}
間取り: ${d.layout}
所在地: ${d.address}
駐車場: ${d.parking}
ペット: ${d.pet}
建物構造: ${d.building}
セキュリティ: ${d.security}
設備: ${d.equipment}
バス・トイレ: ${d.bath}
キッチン: ${d.kitchen}
収納: ${d.storage}
インターネット: ${d.internet}
不動産会社: ${d.company}

${layoutInstructions}
${staffInstructions}
${multiImageInstructions}

════════════════════════════════════════════════════════
【デザイン仕様】
════════════════════════════════════════════════════════
カラー:
- メイン: 紺色 (#1a365d)
- アクセント: ゴールド (#d69e2e)、水色 (#4299e1)
- 背景: 白 (#ffffff)
- テキスト: ダークグレー (#2d3748)

フォント:
- タイトル: 太字、大きめ
- 価格: 最大サイズ、目立つ色
- 本文: 読みやすいサイズ

要素:
- 角丸のカード
- アイコン付き情報
- 適度な余白
- プロフェッショナルな印象

════════════════════════════════════════════════════════
【必須表示テキスト（正確に日本語で）】
════════════════════════════════════════════════════════
「${d.title}」
「${d.price}」
「${d.layout}」
「${d.address}」
「${d.parking}」
「${d.company}」
「お問い合わせはこちら」
${hasStaffPhoto ? '+ スタッフ吹き出し: 物件の魅力を表す短いコメント（AIが物件データから生成、10文字以内）' : ''}

【重要】
- 全テキストは正確な日本語で表示
- 文字化けなし
- 印刷可能な品質
- アスペクト比: ${aspectRatio}
${hasStaffPhoto ? '- スタッフ写真を必ず含め、吹き出しには物件の魅力を表すコメントを生成' : ''}
${propertyImageCount > 1 ? `- 提供された${propertyImageCount}枚の物件写真を全て使用` : ''}
`;
}

// ---------------------------------------------------------------------------
// Standard / collage / magazine / overlay prompts
// ---------------------------------------------------------------------------

const STANDARD_STAFF_SECTION = `
【スタッフ写真の加工・配置】
- 提供されたスタッフ写真を「案内ポーズ」に加工
- 手を物件の方向に差し出し、案内している雰囲気に
- 明るい笑顔で親しみやすい表情（必ず笑顔にする）
- 右下に配置、円形の白い枠で囲む
- 吹き出しに物件の魅力コメントを生成（10文字以内）`;

interface BuildStandardImagePromptInput {
    propertyDetails: PropertyDetails;
    modeInstructions: string;
    styleDescription: string;
    propertyImageCount: number;
    hasStaffPhoto: boolean;
    aspectRatio: string;
}

export function buildStandardImagePrompt(input: BuildStandardImagePromptInput): string {
    const { propertyDetails: d, modeInstructions, styleDescription, propertyImageCount, hasStaffPhoto, aspectRatio } = input;
    const staffSection = hasStaffPhoto ? STANDARD_STAFF_SECTION : '';

    return `
日本語の不動産マーケティング画像を作成してください。
${hasStaffPhoto ? 'スタッフが物件を紹介するスタイルで。' : ''}

【物件情報】
📍 物件名: ${d.title}
💰 家賃: ${d.price}
🏠 間取り: ${d.layout}
📍 所在地: ${d.address}
🚗 駐車場: ${d.parking}
🐕 ペット: ${d.pet}
🏢 不動産会社: ${d.company}

${modeInstructions}
${staffSection}

【表示する文字（正確に日本語で）】
- 「${d.title}」
- 「${d.price}」（最も目立つように）
- 「${d.layout}」
- 「${d.parking}」
- 「お問い合わせはこちら」
${hasStaffPhoto ? '- スタッフ吹き出し: 物件の魅力を表す短いコメント' : ''}

【スタイル】
${styleDescription}
- プロフェッショナルな不動産広告デザイン
- アスペクト比: ${aspectRatio}

【重要】
- 全てのテキストは正確な日本語で表示
- 文字が読みやすいようにコントラストを確保
${hasStaffPhoto ? '- スタッフ写真は「案内ポーズ」に加工（手を差し出して物件を紹介している雰囲気）' : ''}
${propertyImageCount > 1 ? `- 提供された${propertyImageCount}枚の物件写真を使用` : ''}
`;
}

const COLLAGE_STAFF_SECTION = `
【スタッフ写真の加工・配置 - 重要】
提供されたスタッフ写真を以下のように加工してください：
■ ポーズの加工（必須）
- スタッフが「物件を案内している」雰囲気に加工
- 手を物件写真に向けて差し出し、案内しているポーズに変更
- 明るい笑顔で親しみやすい表情（必ず笑顔にする）
- 歯を見せた自然な笑顔が望ましい
- 片手を物件の方向に伸ばし「こちらの物件です」と案内しているポーズ
■ 配置
- 右下に配置、円形の白い枠で囲む
- 吹き出しに物件の魅力を表す短いコメントを日本語で生成
  （例：「駐車場広々！」「ペットOK！」「便利な立地！」など）`;

export type CollageTemplate = 'collage' | 'magazine' | 'overlay';

const COLLAGE_INSTRUCTIONS: Record<CollageTemplate, string> = {
    collage: `
【コラージュレイアウト】
- 複数の物件写真をコラージュ風に配置
- 写真同士が少し重なり合うスタイル
- 斜めに配置したり、サイズを変えて動きを出す
- 中央に価格と物件名を大きく配置`,
    magazine: `
【雑誌風レイアウト】
- 不動産雑誌の1ページのようなデザイン
- 大きなメイン写真と小さなサブ写真
- 洗練されたタイポグラフィ
- 見出し、本文、キャプションの階層構造`,
    overlay: `
【オーバーレイレイアウト】
- 物件写真を全面に配置
- 半透明のオーバーレイで情報を重ねる
- グラデーション効果で文字を読みやすく
- 写真の魅力を最大限に活かす`,
};

interface BuildCollageImagePromptInput {
    template: CollageTemplate;
    propertyDetails: PropertyDetails;
    styleDescription: string;
    propertyImageCount: number;
    hasStaffPhoto: boolean;
    aspectRatio: string;
}

export function buildCollageImagePrompt(input: BuildCollageImagePromptInput): string {
    const { template, propertyDetails: d, styleDescription, propertyImageCount, hasStaffPhoto, aspectRatio } = input;
    const templateInstructions = COLLAGE_INSTRUCTIONS[template];
    const staffSection = hasStaffPhoto ? COLLAGE_STAFF_SECTION : '';
    const multiImageSection = propertyImageCount > 1 ? `
【複数画像の使用 - 重要】
提供された${propertyImageCount}枚の物件写真を全て使用してください。
- メイン写真を大きく配置
- サブ写真を小さく配置（コラージュ風）` : '';

    return `
日本語の不動産マーケティング画像を作成してください。
${hasStaffPhoto ? 'スタッフが物件を紹介するスタイルで。' : ''}

【物件情報】
📍 物件名: ${d.title}
💰 家賃: ${d.price}
🏠 間取り: ${d.layout}
📍 所在地: ${d.address}
🚗 駐車場: ${d.parking}
🐕 ペット: ${d.pet}
🏢 不動産会社: ${d.company}

${templateInstructions}
${staffSection}
${multiImageSection}

【表示する文字（正確に日本語で）】
- 「${d.title}」
- 「${d.price}」（最も目立つように）
- 「${d.layout}」
- 「${d.parking}」
- 「お問い合わせはこちら」
${hasStaffPhoto ? '- スタッフ吹き出し: 物件の魅力を表す短いコメント（AIが物件データから生成）' : ''}

【スタイル】
${styleDescription}
- プロフェッショナルな不動産広告デザイン
- アスペクト比: ${aspectRatio}

【重要】
- 全てのテキストは正確な日本語で表示
- 文字が読みやすいようにコントラストを確保
${hasStaffPhoto ? '- スタッフ写真を必ず含め、吹き出しには物件の魅力を表す短いコメントを生成' : ''}
${propertyImageCount > 1 ? '- 提供された全ての物件写真を使用' : ''}
`;
}

export function isCollageTemplate(template: string): template is CollageTemplate {
    return template === 'collage' || template === 'magazine' || template === 'overlay';
}

// ---------------------------------------------------------------------------
// Business document / infographic / staff-only / default fallback
// ---------------------------------------------------------------------------

interface CommonStaffPromptInput {
    propertyDetails: PropertyDetails;
    aspectRatio: string;
    hasStaffPhoto: boolean;
}

const BUSINESS_DOC_STAFF_SECTION = `
【スタッフ写真の加工・配置】
- 提供されたスタッフ写真を「案内ポーズ」に加工
- 手を物件写真の方向に差し出し、案内している雰囲気に
- 明るい笑顔で親しみやすい表情（必ず笑顔にする）
- 歯を見せた自然な笑顔で物件を紹介しているポーズ
- 右下に配置、円形フレームで囲む
- 吹き出しでコメント追加`;

export function buildBusinessDocumentPrompt(input: CommonStaffPromptInput): string {
    const { propertyDetails: d, aspectRatio, hasStaffPhoto } = input;
    const staff = hasStaffPhoto ? BUSINESS_DOC_STAFF_SECTION : '';
    return `
日本語のビジネス提案書スタイルの不動産インフォグラフィックを作成してください。
1枚で全ての物件情報が伝わる、プロフェッショナルな資料デザインです。

═══════════════════════════════════════════
【物件データ】
═══════════════════════════════════════════
物件名: ${d.title}
家賃: ${d.price}
敷金/礼金: ${d.deposit}
間取り: ${d.layout}
所在地: ${d.address}
駐車場: ${d.parking}
ペット: ${d.pet}
建物構造: ${d.building}
セキュリティ: ${d.security}
設備: ${d.equipment}
バス・トイレ: ${d.bath}
キッチン: ${d.kitchen}
収納: ${d.storage}
インターネット: ${d.internet}
不動産会社: ${d.company}

═══════════════════════════════════════════
【インフォグラフィックレイアウト】
═══════════════════════════════════════════

┌─────────────────────────────────────────┐
│  【ヘッダー】紺色背景                      │
│  🏠 ${d.title}             │
│  💰 ${d.price} ←目立つ大文字 │
└─────────────────────────────────────────┘
         │
┌────────┴────────┬──────────────────────┐
│                 │                      │
│  【メイン写真】   │  【基本情報カード】    │
│  物件外観/内観   │  ┌────────────────┐  │
│                 │  │🏠 間取り        │  │
│                 │  │${d.layout}│
│                 │  ├────────────────┤  │
│                 │  │📍 所在地        │  │
│                 │  │${d.address}│
│                 │  ├────────────────┤  │
│                 │  │🚗 駐車場        │  │
│                 │  │${d.parking}│
│                 │  └────────────────┘  │
├─────────────────┴──────────────────────┤
│  【設備・特徴アイコン】横並び              │
│  🔐セキュリティ  🐕ペット  🍳キッチン      │
│  🛁バストイレ   📺インターネット           │
├────────────────────────────────────────┤
│  【費用詳細】3カラム                      │
│  敷金 │ 礼金 │ 仲介手数料                │
├────────────────────────────────────────┤
│  【フッター】                            │
│  🏢 ${d.company}          │
│  📞 お問い合わせはこちら [ボタン]         │
└────────────────────────────────────────┘

═══════════════════════════════════════════
【デザイン仕様】
═══════════════════════════════════════════
- カラースキーム:
  - メイン: 紺色 (#1e3a5f)
  - アクセント: 黄色 (#ffd700)、水色 (#87ceeb)
  - 背景: 白 (#ffffff)
  - テキスト: 濃い灰色 (#333333)

- アイコン: 各情報項目にアイコンを付与
- カード: 情報をカード形式でグループ化
- 矢印/フロー: 情報の流れを視覚化
- バッジ: 「おすすめ」「新着」などのラベル

- フォント:
  - タイトル: 太字、大きめ
  - 本文: 読みやすい標準サイズ
  - 価格: 最も目立つサイズ

- 視覚的要素:
  - グラデーション背景（微妙に）
  - ドロップシャドウ（カードに深み）
  - 区切り線（セクション分け）

═══════════════════════════════════════════
【必須表示文字（正確に日本語で）】
═══════════════════════════════════════════
「${d.title}」
「${d.price}」
「${d.layout}」
「${d.address}」
「${d.parking}」
「${d.deposit}」
「${d.company}」
「お問い合わせはこちら」

【重要】
- 全テキストは正確な日本語で表示
- 文字化けや崩れなし
- プロフェッショナルなビジネス資料品質
- 印刷しても読みやすいデザイン
- アスペクト比: ${aspectRatio}
${staff}
`;
}

export function buildInfographicPrompt(input: CommonStaffPromptInput): string {
    const { propertyDetails: d, aspectRatio, hasStaffPhoto } = input;
    const staff = hasStaffPhoto ? `
【スタッフ写真の加工・配置】
- 提供されたスタッフ写真を「案内ポーズ」に加工
- 手を物件写真の方向に差し出し、案内している雰囲気に
- 明るい笑顔で親しみやすい表情（必ず笑顔にする）
- 歯を見せた自然な笑顔で物件を紹介しているポーズ
- フッター付近に配置、円形フレームで囲む
- 吹き出しで「おすすめです！」などのコメント` : '';
    return `
日本語の不動産インフォグラフィックを作成してください。
ビジネス提案書や紙資料に使える、1枚で全情報が伝わるプロフェッショナルなデザインです。

════════════════════════════════════════════════════════════
【物件データ（全て画像に含める）】
════════════════════════════════════════════════════════════
🏠 物件名: ${d.title}
💰 家賃: ${d.price}
📝 敷金/礼金: ${d.deposit}
🏠 間取り: ${d.layout}
📍 所在地: ${d.address}
🚗 駐車場: ${d.parking}
🐕 ペット: ${d.pet}
🏗️ 建物構造: ${d.building}
🔐 セキュリティ: ${d.security}
📺 設備: ${d.equipment}
🛁 バス・トイレ: ${d.bath}
🍳 キッチン: ${d.kitchen}
📦 収納: ${d.storage}
🌐 ネット: ${d.internet}
🏢 不動産会社: ${d.company}

════════════════════════════════════════════════════════════
【インフォグラフィック構成】
════════════════════════════════════════════════════════════

┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃  【ヘッダーセクション】                                ┃
┃  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  ┃
┃  物件名: ${d.title}                    ┃
┃  ★ ${d.price} ★ ←最大サイズ、黄色背景  ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
              ↓
┏━━━━━━━━━━━━━━━━┳━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃                  ┃                                  ┃
┃  【物件写真】     ┃  【物件スペック】                  ┃
┃                  ┃  ┌──────────────────────────┐   ┃
┃  提供された写真   ┃  │ 🏠 ${d.layout}│   ┃
┃  を大きく配置    ┃  │ 📍 ${d.address}│  ┃
┃                  ┃  │ 🚗 ${d.parking}│  ┃
┃                  ┃  │ 🐕 ${d.pet}   │   ┃
┃                  ┃  └──────────────────────────┘   ┃
┃                  ┃                                  ┃
┗━━━━━━━━━━━━━━━━┻━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
              ↓
┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃  【設備・特徴セクション】アイコン付きグリッド         ┃
┃  ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐          ┃
┃  │🔐  │ │🛁  │ │🍳  │ │📺  │ │📦  │          ┃
┃  │セキュ│ │バス │ │キッチ│ │ネット│ │収納 │          ┃
┃  └────┘ └────┘ └────┘ └────┘ └────┘          ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
              ↓
┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃  【費用詳細セクション】3カラム比較表                  ┃
┃  ┌──────┐  ┌──────┐  ┌──────┐                  ┃
┃  │ 敷金  │  │ 礼金  │  │ 手数料 │                  ┃
┃  │${d.deposit}│                       ┃
┃  └──────┘  └──────┘  └──────┘                  ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
              ↓
┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃  【フッター】                                       ┃
┃  🏢 ${d.company}                     ┃
┃  ┌─────────────────────────────────────────┐      ┃
┃  │  📞 お問い合わせはこちら  →              │      ┃
┃  └─────────────────────────────────────────┘      ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛

════════════════════════════════════════════════════════════
【デザイン仕様】
════════════════════════════════════════════════════════════
カラーパレット:
- プライマリ: 紺色 (#1a365d)
- セカンダリ: 水色 (#63b3ed)
- アクセント: 黄色/ゴールド (#f6e05e)
- 背景: 白/薄いグレー (#f7fafc)
- テキスト: ダークグレー (#2d3748)

デザイン要素:
- 各セクションは角丸のカードで囲む
- アイコンは円形背景付き
- 矢印やフローラインで情報の流れを表現
- グラデーション背景（微妙に）
- 適度な余白とパディング
- 影効果でカードに深みを出す

フォント:
- タイトル: 太字、24-32pt相当
- 価格: 最大、太字、36-48pt相当、アクセントカラー
- 本文: 12-14pt相当、読みやすさ重視
- ラベル: 10-12pt相当、グレー

════════════════════════════════════════════════════════════
【必須表示テキスト（正確に日本語で）】
════════════════════════════════════════════════════════════
「${d.title}」
「${d.price}」
「${d.layout}」
「${d.address}」
「${d.parking}」
「${d.deposit}」
「${d.company}」
「お問い合わせはこちら」

【重要な指示】
- 全てのテキストは正確な日本語で表示すること
- 文字化け、崩れ、誤字は絶対に避ける
- ビジネス資料として印刷可能な品質
- 情報の階層が明確に分かるデザイン
- 1枚で物件の全てが分かる完結したデザイン
- アスペクト比: ${aspectRatio}
${staff}
`;
}

interface BuildStaffOnlyPromptInput {
    propertyDetails: PropertyDetails;
    propertyImageCount: number;
    styleDescription: string;
    aspectRatio: string;
}

export function buildStaffOnlyPrompt(input: BuildStaffOnlyPromptInput): string {
    const { propertyDetails: d, propertyImageCount, styleDescription, aspectRatio } = input;
    return `
1枚で物件紹介ができる不動産マーケティング画像を作成してください。
スタッフが物件を紹介するスタイルで。

【物件情報（全て画像に含める）】
📍 物件名: ${d.title}
💰 家賃: ${d.price}
🏠 間取り: ${d.layout}
📍 所在地: ${d.address}
🚗 駐車場: ${d.parking}
🐕 ペット: ${d.pet}
🏢 不動産会社: ${d.company}

【レイアウト】
- 左側または背景: 物件写真${propertyImageCount > 1 ? `（提供された${propertyImageCount}枚全てを使用）` : ''}
- 右下: スタッフ写真（円形フレーム、白い縁取り）
- スタッフの吹き出しに物件の魅力を表すコメントを生成
- 上部: 物件名と家賃（大きく目立つ）
- 中央または側面: 物件情報リスト
- 下部: 「お問い合わせはこちら」ボタン

【スタッフ写真の加工 - 最重要】
提供されたスタッフ写真を以下のように加工してください：
- スタッフが「物件を案内している」雰囲気に加工
- 手を物件写真の方向に差し出し、案内しているポーズに変更
- 「こちらの物件をご紹介します」と言っているような自然なポーズ
- 明るい笑顔で親しみやすい表情（必ず笑顔にする）
- 歯を見せた自然な笑顔が望ましい
- 不動産営業スタッフとして物件を紹介している雰囲気

【吹き出しコメント - AIで生成】
物件の特徴を分析して、魅力的な一言コメントを日本語で生成してください（10文字以内）
例：
- 駐車場${d.parking} → 「駐車場広々！」
- ペット${d.pet} → 「ペットOK！」
- 価格がお得 → 「お得な物件！」
- 立地が良い → 「便利な立地！」

【表示する文字（正確に日本語で）】
- 「${d.title}」
- 「${d.price}」（最も目立つように）
- 「${d.layout}」
- 「${d.parking}」
- 「お問い合わせはこちら」
- スタッフ吹き出し: 物件の特徴に基づいた短いコメント

【スタイル】
${styleDescription}
アスペクト比: ${aspectRatio}

【重要】
- 全てのテキストは正確な日本語で表示
- 1枚で物件の魅力が伝わるデザイン
- スタッフ写真は「案内ポーズ」に加工（手を差し出して物件を紹介している雰囲気）
- スタッフの吹き出しには物件の魅力を表す短いコメントを生成
${propertyImageCount > 1 ? `- 提供された${propertyImageCount}枚の物件写真を全て使用` : ''}
`;
}

interface BuildDefaultPromptInput {
    propertyDetails: PropertyDetails;
    highlights: string[];
    styleDescription: string;
    aspectRatio: string;
}

export function buildDefaultImagePrompt(input: BuildDefaultPromptInput): string {
    const { propertyDetails: d, highlights, styleDescription, aspectRatio } = input;
    return `
1枚で物件紹介ができる不動産マーケティング画像を作成してください。

【物件情報（全て画像に含める）】
📍 物件名: ${d.title}
💰 家賃: ${d.price}
🏠 間取り: ${d.layout}
📍 所在地: ${d.address}
🚗 駐車場: ${d.parking}
🐕 ペット: ${d.pet}

【主要ポイント】
${highlights.join('\n')}

【レイアウト】
- 背景: 物件写真（提供された画像を使用）
- 上部: 物件名（大きく目立つ白文字、影付き）
- 中央: 家賃（最も目立つ、バッジまたはリボン風）
- 下部または側面: 物件詳細（間取り、駐車場など）
- 最下部: 「お問い合わせはこちら」ボタン

【表示する文字（正確に日本語で）】
- 「${d.title}」（タイトル）
- 「${d.price}」（家賃、最も大きく）
- 「${d.layout}」（間取り）
- 「駐車場 ${d.parking}」
- 「お問い合わせはこちら」（CTAボタン）

【スタイル】
${styleDescription}
- プロフェッショナルな不動産広告デザイン
- 読みやすいフォント
- アスペクト比: ${aspectRatio}

【重要】
- 全てのテキストは正確な日本語で表示すること
- 文字が読みやすいようにコントラストを確保
- 1枚で物件の魅力が全て伝わるデザイン
`;
}

export function isProposalTemplate(template: string): template is `proposal_${ProposalTemplateType}` {
    return template === 'proposal_card'
        || template === 'proposal_compare'
        || template === 'proposal_flow'
        || template === 'proposal_grid';
}

export function parseProposalTemplate(template: string): ProposalTemplateType | null {
    if (!isProposalTemplate(template)) return null;
    return template.replace('proposal_', '') as ProposalTemplateType;
}
