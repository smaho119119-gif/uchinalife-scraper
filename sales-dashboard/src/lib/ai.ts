import { GoogleGenerativeAI } from "@google/generative-ai";
import OpenAI from "openai";
import { getStyleDescription } from "@/lib/ai-styles";
import { buildSalesCopyPrompt } from "@/prompts/sales-copy";
import {
    extractPropertyDetails,
    buildPropertyHighlights,
} from "@/prompts/property-fields";
import {
    buildProposalImagePrompt,
    parseProposalTemplate,
} from "@/prompts/property-image";
import { getStandardModeInstructions } from "@/prompts/property-image-modes";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || '' });

// ============================================
// モデル定義（2025年11月最新）
// ============================================
export const AI_MODELS = {
    // 画像生成モデル
    // ドキュメント: https://ai.google.dev/gemini-api/docs/gemini-3
    image: {
        'gemini-3-pro': {
            id: 'gemini-3-pro-image-preview',  // 画像生成専用モデル
            name: 'Gemini 3 Pro Image (最新)',
            description: '最高品質・4K・日本語テキスト完全対応',
            provider: 'google',
            default: true,
        },
        'gemini-2.5-flash': {
            id: 'gemini-2.5-flash-image-preview',
            name: 'Gemini 2.5 Flash Image',
            description: '高速・低コスト',
            provider: 'google',
            default: false,
        },
    },
    // テキスト生成モデル
    text: {
        'gemini-3-pro': {
            id: 'gemini-3-pro-preview',
            name: 'Gemini 3 Pro (最新)',
            description: '最高品質・動的思考搭載',
            provider: 'google',
            default: true,
        },
        'gemini-2.5-flash': {
            id: 'gemini-2.5-flash-preview-05-20',
            name: 'Gemini 2.5 Flash',
            description: '高速・低コスト',
            provider: 'google',
            default: false,
        },
        'gpt-4o-mini': {
            id: 'gpt-4o-mini',
            name: 'GPT-4o Mini',
            description: 'OpenAI・高速・低コスト',
            provider: 'openai',
            default: false,
        },
    },
} as const;

export type ImageModelKey = keyof typeof AI_MODELS.image;
export type TextModelKey = keyof typeof AI_MODELS.text;

// Style description helper lives in lib/ai-styles.ts (lookup table).

// ============================================
// テキスト生成（セールスコピー）
// ============================================
export async function generateSalesCopy(
    property: any,
    modelKey: TextModelKey = 'gemini-3-pro'
) {
    const modelConfig = AI_MODELS.text[modelKey];
    const prompt = buildSalesCopyPrompt(property);

    try {
        if (modelConfig.provider === 'openai') {
            // OpenAI (GPT-4o-mini)
            const response = await openai.chat.completions.create({
                model: modelConfig.id,
                messages: [{ role: 'user', content: prompt }],
                temperature: 0.7,
            });
            return response.choices[0]?.message?.content || '';
        } else {
            // Google Gemini
            const model = genAI.getGenerativeModel({ model: modelConfig.id });
            const result = await model.generateContent(prompt);
            const response = await result.response;
            return response.text();
        }
    } catch (error) {
        console.error(`${modelConfig.name} API Error:`, error);
        throw error;
    }
}

// ============================================
// 画像生成（物件画像付き）
// ============================================
export async function generatePropertyImageWithPhotos(options: {
    propertyData: any;
    propertyImages: Array<{ data: string, mimeType: string }>;
    staffPhoto: { data: string, mimeType: string } | null;
    mode: string;
    size: string;
    aspectRatio: string;
    style: string;
    template?: string;
    modelKey?: ImageModelKey;
}) {
    const modelKey = options.modelKey || 'gemini-3-pro';
    const modelConfig = AI_MODELS.image[modelKey];
    
    try {
        // 古いSDKを使用（responseModalitiesで画像出力を有効化）
        const model = genAI.getGenerativeModel({
            model: modelConfig.id,
            generationConfig: {
                temperature: 1.0,
                // @ts-expect-error responseModalities is accepted at runtime by Gemini image models but is not yet in the SDK type defs (re-check after @google/generative-ai upgrade).
                responseModalities: ['TEXT', 'IMAGE'],
            }
        });

        // Build prompt based on mode and whether staff photo is included
        let prompt = '';
        
        // 物件詳細を抽出（共通 helper）
        const propertyDetails = extractPropertyDetails(options.propertyData);
        const highlights = buildPropertyHighlights(propertyDetails);

        const template = options.template || 'standard';
        
        console.log(`Processing template: ${template}, mode: ${options.mode}, hasStaffPhoto: ${!!options.staffPhoto}`);

        // ===== 提案書テンプレート（紙資料用） =====
        if (template.startsWith('proposal_')) {
            const proposalType = parseProposalTemplate(template);
            if (proposalType) {
                console.log(`Using proposal template prompt: ${proposalType}`);
                prompt = buildProposalImagePrompt({
                    template: proposalType,
                    propertyDetails,
                    propertyImageCount: options.propertyImages.length,
                    hasStaffPhoto: !!options.staffPhoto,
                    aspectRatio: options.aspectRatio,
                });
            }
        }
        // ===== スタンダードテンプレート（モード別処理） =====
        else if (template === 'standard') {
            console.log(`Using standard template with mode: ${options.mode}`);
            
            // モード別のレイアウト指示（テーブル化済み）
            const modeInstructions = getStandardModeInstructions(options.mode);
            
            const staffSection = options.staffPhoto ? `
【スタッフ写真の加工・配置】
- 提供されたスタッフ写真を「案内ポーズ」に加工
- 手を物件の方向に差し出し、案内している雰囲気に
- 明るい笑顔で親しみやすい表情（必ず笑顔にする）
- 右下に配置、円形の白い枠で囲む
- 吹き出しに物件の魅力コメントを生成（10文字以内）` : '';

            prompt = `
日本語の不動産マーケティング画像を作成してください。
${options.staffPhoto ? 'スタッフが物件を紹介するスタイルで。' : ''}

【物件情報】
📍 物件名: ${propertyDetails.title}
💰 家賃: ${propertyDetails.price}
🏠 間取り: ${propertyDetails.layout}
📍 所在地: ${propertyDetails.address}
🚗 駐車場: ${propertyDetails.parking}
🐕 ペット: ${propertyDetails.pet}
🏢 不動産会社: ${propertyDetails.company}

${modeInstructions}
${staffSection}

【表示する文字（正確に日本語で）】
- 「${propertyDetails.title}」
- 「${propertyDetails.price}」（最も目立つように）
- 「${propertyDetails.layout}」
- 「${propertyDetails.parking}」
- 「お問い合わせはこちら」
${options.staffPhoto ? '- スタッフ吹き出し: 物件の魅力を表す短いコメント' : ''}

【スタイル】
${getStyleDescription(options.style)}
- プロフェッショナルな不動産広告デザイン
- アスペクト比: ${options.aspectRatio}

【重要】
- 全てのテキストは正確な日本語で表示
- 文字が読みやすいようにコントラストを確保
${options.staffPhoto ? '- スタッフ写真は「案内ポーズ」に加工（手を差し出して物件を紹介している雰囲気）' : ''}
${options.propertyImages.length > 1 ? `- 提供された${options.propertyImages.length}枚の物件写真を使用` : ''}
`;
        }
        // ===== コラージュ・雑誌風・オーバーレイテンプレート =====
        else if (template === 'collage' || template === 'magazine' || template === 'overlay') {
            console.log(`Using ${template} template prompt`);
            
            let templateInstructions = '';
            if (template === 'collage') {
                templateInstructions = `
【コラージュレイアウト】
- 複数の物件写真をコラージュ風に配置
- 写真同士が少し重なり合うスタイル
- 斜めに配置したり、サイズを変えて動きを出す
- 中央に価格と物件名を大きく配置`;
            } else if (template === 'magazine') {
                templateInstructions = `
【雑誌風レイアウト】
- 不動産雑誌の1ページのようなデザイン
- 大きなメイン写真と小さなサブ写真
- 洗練されたタイポグラフィ
- 見出し、本文、キャプションの階層構造`;
            } else if (template === 'overlay') {
                templateInstructions = `
【オーバーレイレイアウト】
- 物件写真を全面に配置
- 半透明のオーバーレイで情報を重ねる
- グラデーション効果で文字を読みやすく
- 写真の魅力を最大限に活かす`;
            }

            const staffSection = options.staffPhoto ? `
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
  （例：「駐車場広々！」「ペットOK！」「便利な立地！」など）` : '';

            const multiImageSection = options.propertyImages.length > 1 ? `
【複数画像の使用 - 重要】
提供された${options.propertyImages.length}枚の物件写真を全て使用してください。
- メイン写真を大きく配置
- サブ写真を小さく配置（コラージュ風）` : '';

            prompt = `
日本語の不動産マーケティング画像を作成してください。
${options.staffPhoto ? 'スタッフが物件を紹介するスタイルで。' : ''}

【物件情報】
📍 物件名: ${propertyDetails.title}
💰 家賃: ${propertyDetails.price}
🏠 間取り: ${propertyDetails.layout}
📍 所在地: ${propertyDetails.address}
🚗 駐車場: ${propertyDetails.parking}
🐕 ペット: ${propertyDetails.pet}
🏢 不動産会社: ${propertyDetails.company}

${templateInstructions}
${staffSection}
${multiImageSection}

【表示する文字（正確に日本語で）】
- 「${propertyDetails.title}」
- 「${propertyDetails.price}」（最も目立つように）
- 「${propertyDetails.layout}」
- 「${propertyDetails.parking}」
- 「お問い合わせはこちら」
${options.staffPhoto ? '- スタッフ吹き出し: 物件の魅力を表す短いコメント（AIが物件データから生成）' : ''}

【スタイル】
${getStyleDescription(options.style)}
- プロフェッショナルな不動産広告デザイン
- アスペクト比: ${options.aspectRatio}

【重要】
- 全てのテキストは正確な日本語で表示
- 文字が読みやすいようにコントラストを確保
${options.staffPhoto ? '- スタッフ写真を必ず含め、吹き出しには物件の魅力を表す短いコメントを生成' : ''}
${options.propertyImages.length > 1 ? '- 提供された全ての物件写真を使用' : ''}
`;
        }
        // ビジネス資料モード（インフォグラフィック）
        else if (options.mode === 'document' && options.style === 'business') {
            console.log('Using business document prompt');
            prompt = `
日本語のビジネス提案書スタイルの不動産インフォグラフィックを作成してください。
1枚で全ての物件情報が伝わる、プロフェッショナルな資料デザインです。

═══════════════════════════════════════════
【物件データ】
═══════════════════════════════════════════
物件名: ${propertyDetails.title}
家賃: ${propertyDetails.price}
敷金/礼金: ${propertyDetails.deposit}
間取り: ${propertyDetails.layout}
所在地: ${propertyDetails.address}
駐車場: ${propertyDetails.parking}
ペット: ${propertyDetails.pet}
建物構造: ${propertyDetails.building}
セキュリティ: ${propertyDetails.security}
設備: ${propertyDetails.equipment}
バス・トイレ: ${propertyDetails.bath}
キッチン: ${propertyDetails.kitchen}
収納: ${propertyDetails.storage}
インターネット: ${propertyDetails.internet}
不動産会社: ${propertyDetails.company}

═══════════════════════════════════════════
【インフォグラフィックレイアウト】
═══════════════════════════════════════════

┌─────────────────────────────────────────┐
│  【ヘッダー】紺色背景                      │
│  🏠 ${propertyDetails.title}             │
│  💰 ${propertyDetails.price} ←目立つ大文字 │
└─────────────────────────────────────────┘
         │
┌────────┴────────┬──────────────────────┐
│                 │                      │
│  【メイン写真】   │  【基本情報カード】    │
│  物件外観/内観   │  ┌────────────────┐  │
│                 │  │🏠 間取り        │  │
│                 │  │${propertyDetails.layout}│
│                 │  ├────────────────┤  │
│                 │  │📍 所在地        │  │
│                 │  │${propertyDetails.address}│
│                 │  ├────────────────┤  │
│                 │  │🚗 駐車場        │  │
│                 │  │${propertyDetails.parking}│
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
│  🏢 ${propertyDetails.company}          │
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
「${propertyDetails.title}」
「${propertyDetails.price}」
「${propertyDetails.layout}」
「${propertyDetails.address}」
「${propertyDetails.parking}」
「${propertyDetails.deposit}」
「${propertyDetails.company}」
「お問い合わせはこちら」

【重要】
- 全テキストは正確な日本語で表示
- 文字化けや崩れなし
- プロフェッショナルなビジネス資料品質
- 印刷しても読みやすいデザイン
- アスペクト比: ${options.aspectRatio}
${options.staffPhoto ? `
【スタッフ写真の加工・配置】
- 提供されたスタッフ写真を「案内ポーズ」に加工
- 手を物件写真の方向に差し出し、案内している雰囲気に
- 明るい笑顔で親しみやすい表情（必ず笑顔にする）
- 歯を見せた自然な笑顔で物件を紹介しているポーズ
- 右下に配置、円形フレームで囲む
- 吹き出しでコメント追加` : ''}
`;
        } else if (options.mode === 'infographic') {
            // インフォグラフィック専用モード
            console.log('Using infographic prompt');
            prompt = `
日本語の不動産インフォグラフィックを作成してください。
ビジネス提案書や紙資料に使える、1枚で全情報が伝わるプロフェッショナルなデザインです。

════════════════════════════════════════════════════════════
【物件データ（全て画像に含める）】
════════════════════════════════════════════════════════════
🏠 物件名: ${propertyDetails.title}
💰 家賃: ${propertyDetails.price}
📝 敷金/礼金: ${propertyDetails.deposit}
🏠 間取り: ${propertyDetails.layout}
📍 所在地: ${propertyDetails.address}
🚗 駐車場: ${propertyDetails.parking}
🐕 ペット: ${propertyDetails.pet}
🏗️ 建物構造: ${propertyDetails.building}
🔐 セキュリティ: ${propertyDetails.security}
📺 設備: ${propertyDetails.equipment}
🛁 バス・トイレ: ${propertyDetails.bath}
🍳 キッチン: ${propertyDetails.kitchen}
📦 収納: ${propertyDetails.storage}
🌐 ネット: ${propertyDetails.internet}
🏢 不動産会社: ${propertyDetails.company}

════════════════════════════════════════════════════════════
【インフォグラフィック構成】
════════════════════════════════════════════════════════════

┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃  【ヘッダーセクション】                                ┃
┃  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  ┃
┃  物件名: ${propertyDetails.title}                    ┃
┃  ★ ${propertyDetails.price} ★ ←最大サイズ、黄色背景  ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
              ↓
┏━━━━━━━━━━━━━━━━┳━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃                  ┃                                  ┃
┃  【物件写真】     ┃  【物件スペック】                  ┃
┃                  ┃  ┌──────────────────────────┐   ┃
┃  提供された写真   ┃  │ 🏠 ${propertyDetails.layout}│   ┃
┃  を大きく配置    ┃  │ 📍 ${propertyDetails.address}│  ┃
┃                  ┃  │ 🚗 ${propertyDetails.parking}│  ┃
┃                  ┃  │ 🐕 ${propertyDetails.pet}   │   ┃
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
┃  │${propertyDetails.deposit}│                       ┃
┃  └──────┘  └──────┘  └──────┘                  ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
              ↓
┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃  【フッター】                                       ┃
┃  🏢 ${propertyDetails.company}                     ┃
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
「${propertyDetails.title}」
「${propertyDetails.price}」
「${propertyDetails.layout}」
「${propertyDetails.address}」
「${propertyDetails.parking}」
「${propertyDetails.deposit}」
「${propertyDetails.company}」
「お問い合わせはこちら」

【重要な指示】
- 全てのテキストは正確な日本語で表示すること
- 文字化け、崩れ、誤字は絶対に避ける
- ビジネス資料として印刷可能な品質
- 情報の階層が明確に分かるデザイン
- 1枚で物件の全てが分かる完結したデザイン
- アスペクト比: ${options.aspectRatio}
${options.staffPhoto ? `
【スタッフ写真の加工・配置】
- 提供されたスタッフ写真を「案内ポーズ」に加工
- 手を物件写真の方向に差し出し、案内している雰囲気に
- 明るい笑顔で親しみやすい表情（必ず笑顔にする）
- 歯を見せた自然な笑顔で物件を紹介しているポーズ
- フッター付近に配置、円形フレームで囲む
- 吹き出しで「おすすめです！」などのコメント` : ''}
`;
        } else if (options.staffPhoto) {
            console.log('Using staff photo prompt');
            prompt = `
1枚で物件紹介ができる不動産マーケティング画像を作成してください。
スタッフが物件を紹介するスタイルで。

【物件情報（全て画像に含める）】
📍 物件名: ${propertyDetails.title}
💰 家賃: ${propertyDetails.price}
🏠 間取り: ${propertyDetails.layout}
📍 所在地: ${propertyDetails.address}
🚗 駐車場: ${propertyDetails.parking}
🐕 ペット: ${propertyDetails.pet}
🏢 不動産会社: ${propertyDetails.company}

【レイアウト】
- 左側または背景: 物件写真${options.propertyImages.length > 1 ? `（提供された${options.propertyImages.length}枚全てを使用）` : ''}
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
- 駐車場${propertyDetails.parking} → 「駐車場広々！」
- ペット${propertyDetails.pet} → 「ペットOK！」
- 価格がお得 → 「お得な物件！」
- 立地が良い → 「便利な立地！」

【表示する文字（正確に日本語で）】
- 「${propertyDetails.title}」
- 「${propertyDetails.price}」（最も目立つように）
- 「${propertyDetails.layout}」
- 「${propertyDetails.parking}」
- 「お問い合わせはこちら」
- スタッフ吹き出し: 物件の特徴に基づいた短いコメント

【スタイル】
${getStyleDescription(options.style)}
アスペクト比: ${options.aspectRatio}

【重要】
- 全てのテキストは正確な日本語で表示
- 1枚で物件の魅力が伝わるデザイン
- スタッフ写真は「案内ポーズ」に加工（手を差し出して物件を紹介している雰囲気）
- スタッフの吹き出しには物件の魅力を表す短いコメントを生成
${options.propertyImages.length > 1 ? `- 提供された${options.propertyImages.length}枚の物件写真を全て使用` : ''}
`;
        } else {
            console.log('Using default prompt');
            prompt = `
1枚で物件紹介ができる不動産マーケティング画像を作成してください。

【物件情報（全て画像に含める）】
📍 物件名: ${propertyDetails.title}
💰 家賃: ${propertyDetails.price}
🏠 間取り: ${propertyDetails.layout}
📍 所在地: ${propertyDetails.address}
🚗 駐車場: ${propertyDetails.parking}
🐕 ペット: ${propertyDetails.pet}

【主要ポイント】
${highlights.join('\n')}

【レイアウト】
- 背景: 物件写真（提供された画像を使用）
- 上部: 物件名（大きく目立つ白文字、影付き）
- 中央: 家賃（最も目立つ、バッジまたはリボン風）
- 下部または側面: 物件詳細（間取り、駐車場など）
- 最下部: 「お問い合わせはこちら」ボタン

【表示する文字（正確に日本語で）】
- 「${propertyDetails.title}」（タイトル）
- 「${propertyDetails.price}」（家賃、最も大きく）
- 「${propertyDetails.layout}」（間取り）
- 「駐車場 ${propertyDetails.parking}」
- 「お問い合わせはこちら」（CTAボタン）

【スタイル】
${getStyleDescription(options.style)}
- プロフェッショナルな不動産広告デザイン
- 読みやすいフォント
- アスペクト比: ${options.aspectRatio}

【重要】
- 全てのテキストは正確な日本語で表示すること
- 文字が読みやすいようにコントラストを確保
- 1枚で物件の魅力が全て伝わるデザイン
`;
        }

        prompt += `\n\n画像仕様: ${options.size}解像度、${options.aspectRatio}アスペクト比。`;

        // Build parts array with images
        const parts: any[] = [{ text: prompt }];

        // Add property images
        console.log(`Adding ${options.propertyImages.length} property images to prompt`);
        for (const img of options.propertyImages) {
            parts.push({
                inlineData: {
                    data: img.data,
                    mimeType: img.mimeType
                }
            });
        }

        // Add staff photo if provided
        if (options.staffPhoto) {
            console.log('Adding staff photo to prompt');
            parts.push({
                inlineData: {
                    data: options.staffPhoto.data,
                    mimeType: options.staffPhoto.mimeType
                }
            });
        }

        console.log(`Using model: ${modelConfig.name} (${modelConfig.id})`);
        
        // 古いSDKでの呼び出し
        const result = await model.generateContent({
            contents: [{ role: 'user', parts }],
        });

        const response = await result.response;

        // Extract image data from response
        const candidates = response.candidates;
        if (candidates && candidates[0]?.content?.parts) {
            for (const part of candidates[0].content.parts) {
                if (part.inlineData) {
                    return {
                        imageData: part.inlineData.data,
                        mimeType: part.inlineData.mimeType,
                        modelUsed: modelConfig.name,
                    };
                }
            }
        }

        throw new Error('No image generated');
    } catch (error) {
        console.error(`Image Generation with ${modelConfig.name} Error:`, error);
        throw error;
    }
}

// `generatePropertyImage` (URL-only) was removed in Round 9 — it had no callers.
// `generatePropertyImageWithPhotos` covers all current image flows.
