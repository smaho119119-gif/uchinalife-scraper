import { GoogleGenerativeAI } from "@google/generative-ai";
import OpenAI from "openai";

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

// ============================================
// ヘルパー関数
// ============================================
function getStyleDescription(style: string) {
    switch (style) {
        case 'luxury':
            return 'elegant gold and black with premium textures';
        case 'modern':
            return 'clean white and blue with minimalist design';
        case 'classic':
            return 'warm beige and brown with traditional elegance';
        case 'minimal':
            return 'monochrome with lots of white space';
        case 'handdrawn':
            return 'colorful hand-drawn illustration style with playful sketchy lines and vibrant colors';
        case '3d':
            return 'photorealistic 3D rendering with depth, shadows, and modern CGI aesthetic';
        case 'watercolor':
            return 'soft watercolor painting style with gentle color blends and artistic brush strokes';
        case 'neon':
            return 'vibrant neon colors with glowing effects, cyberpunk aesthetic, and electric atmosphere';
        case 'vintage':
            return 'retro vintage style with aged paper texture, sepia tones, and classic typography';
        case 'futuristic':
            return 'sleek futuristic design with metallic elements, holographic effects, and sci-fi aesthetic';
        case 'business':
            return 'professional Japanese business presentation style with clean infographics, charts, and structured layout';
        case 'anime':
            return 'Japanese anime illustration style with vibrant colors and expressive characters';
        default:
            return 'warm neutral tones';
    }
}

// ============================================
// テキスト生成（セールスコピー）
// ============================================
export async function generateSalesCopy(
    property: any,
    modelKey: TextModelKey = 'gemini-3-pro'
) {
    const modelConfig = AI_MODELS.text[modelKey];
    
    const prompt = `
あなたはトップクラスの不動産営業マンです。以下の物件情報をもとに、
魅力的で説得力のあるセールスコピーを作成してください。

物件情報:
- タイトル: ${property.title}
- 価格: ${property.price}
- カテゴリ: ${property.category_name_ja} / ${property.genre_name_ja}
- 会社: ${property.company_name}
- 詳細: ${JSON.stringify(property.property_data, null, 2)}

以下の要素を含めてください:
1. キャッチコピー（目を引く一文）
2. 物件の主要な魅力ポイント（3-5点）
3. ターゲット層への訴求
4. 行動喚起（CTA）

Markdown形式で、見出しや箇条書きを使って読みやすく作成してください。
`;

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
        
        // 物件詳細情報を抽出
        const pd = options.propertyData.property_data || {};
        const propertyDetails = {
            title: options.propertyData.title || '',
            price: pd['家賃'] || pd['価格'] || options.propertyData.price || '',
            deposit: pd['敷金／礼金'] || pd['敷金'] || '',
            layout: pd['間取り'] || '',
            address: pd['所在地'] || pd['住所'] || '',
            parking: pd['駐車場'] || '',
            area: pd['専有面積'] || pd['面積'] || '',
            building: pd['建物構造'] || '',
            floor: pd['部屋番号'] || pd['階'] || '',
            pet: pd['ペット'] || '',
            security: pd['セキュリティ'] || '',
            equipment: pd['家具・家電'] || pd['設備'] || '',
            bath: pd['バス・トイレ'] || '',
            kitchen: pd['キッチン'] || '',
            storage: pd['収納'] || '',
            internet: pd['放送・通信'] || '',
            school: pd['小学校'] || '',
            company: pd['不動産会社'] || options.propertyData.company_name || '',
            remarks: pd['備考'] || '',
        };

        // 主要ポイントを抽出（空でないものだけ）
        const highlights = [
            propertyDetails.layout && `間取り: ${propertyDetails.layout}`,
            propertyDetails.price && `家賃: ${propertyDetails.price}`,
            propertyDetails.deposit && `敷金/礼金: ${propertyDetails.deposit}`,
            propertyDetails.parking && `駐車場: ${propertyDetails.parking}`,
            propertyDetails.security && `セキュリティ: ${propertyDetails.security}`,
            propertyDetails.pet && `ペット: ${propertyDetails.pet}`,
        ].filter(Boolean).slice(0, 6);

        const template = options.template || 'standard';
        
        console.log(`Processing template: ${template}, mode: ${options.mode}, hasStaffPhoto: ${!!options.staffPhoto}`);

        // ===== 提案書テンプレート（紙資料用） =====
        if (template.startsWith('proposal_')) {
            console.log('Using proposal template prompt');
            const templateType = template.replace('proposal_', '');
            
            let layoutInstructions = '';
            
            if (templateType === 'card') {
                // 物件カード型
                layoutInstructions = `
【物件カードレイアウト】名刺サイズの物件紹介カード

┌────────────────────────────────────────┐
│  ┌─────────────┐                       │
│  │             │  🏠 ${propertyDetails.title}   │
│  │  物件写真    │  ─────────────────────│
│  │   (大)      │  💰 ${propertyDetails.price}    │
│  │             │                       │
│  └─────────────┘  📍 ${propertyDetails.address} │
│                                        │
│  ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐     │
│  │🏠    │ │🚗   │ │🐕   │ │🔐   │     │
│  │間取り│ │駐車場│ │ペット│ │セキュリ│     │
│  └─────┘ └─────┘ └─────┘ └─────┘     │
│                                        │
│  🏢 ${propertyDetails.company}         │
│  📞 お問い合わせ ▶                     │
└────────────────────────────────────────┘

- シンプルで見やすいカードデザイン
- 物件写真を左上に大きく配置
- 主要情報を右側に
- 設備はアイコン形式で下部に並べる`;
            } else if (templateType === 'compare') {
                // 比較表付き
                layoutInstructions = `
【比較表付きレイアウト】費用内訳が一目で分かる

┌────────────────────────────────────────┐
│  🏠 ${propertyDetails.title}                     │
│  ★★★ ${propertyDetails.price} ★★★              │
├────────────────────────────────────────┤
│  ┌─────────────────┐  ┌────────────────┐│
│  │                 │  │ 📊 費用詳細    ││
│  │    物件写真     │  │ ┌────┬────┐   ││
│  │                 │  │ │敷金│○○○│   ││
│  │                 │  │ ├────┼────┤   ││
│  │                 │  │ │礼金│○○○│   ││
│  └─────────────────┘  │ ├────┼────┤   ││
│                       │ │仲介│○○○│   ││
│  📍 ${propertyDetails.address}  │ └────┴────┘   ││
│  🏠 ${propertyDetails.layout}   └────────────────┘│
│  🚗 ${propertyDetails.parking}                    │
├────────────────────────────────────────┤
│  🏢 ${propertyDetails.company} │ 📞 お問い合わせ │
└────────────────────────────────────────┘

- 右側に費用比較表
- 初期費用の合計も表示
- 数字は見やすく大きめに`;
            } else if (templateType === 'flow') {
                // フロー型
                layoutInstructions = `
【フロー型レイアウト】情報を段階的に表示

        ${propertyDetails.title}
              ↓
┌────────────────────────────────────────┐
│          💰 ${propertyDetails.price}             │
│          （最重要・最大サイズ）                  │
└────────────────────────────────────────┘
              ↓
┌──────────┐    ┌──────────┐    ┌──────────┐
│ 📍所在地  │ → │ 🏠間取り  │ → │ 🚗駐車場  │
│ ${propertyDetails.address} │    │ ${propertyDetails.layout} │    │ ${propertyDetails.parking} │
└──────────┘    └──────────┘    └──────────┘
              ↓
┌────────────────────────────────────────┐
│  設備: 🔐 セキュリティ │ 🛁 バス │ 🍳 キッチン │
└────────────────────────────────────────┘
              ↓
┌────────────────────────────────────────┐
│  🏢 ${propertyDetails.company}                  │
│  📞 お問い合わせはこちら →                      │
└────────────────────────────────────────┘

- 矢印で情報の流れを表現
- 上から下へ読み進める構造
- 各セクションは明確に区切る`;
            } else if (templateType === 'grid') {
                // グリッド型
                layoutInstructions = `
【グリッド型レイアウト】情報を整然と配置

┌──────────────┬──────────────┬──────────────┐
│              │              │              │
│   物件写真1   │   物件写真2   │   物件写真3   │
│              │              │              │
├──────────────┴──────────────┴──────────────┤
│  🏠 ${propertyDetails.title}                    │
│  💰 ${propertyDetails.price}                     │
├──────────────┬──────────────┬──────────────┤
│ 📍所在地      │ 🏠間取り      │ 🚗駐車場      │
│ ${propertyDetails.address} │ ${propertyDetails.layout} │ ${propertyDetails.parking} │
├──────────────┼──────────────┼──────────────┤
│ 🐕ペット      │ 🔐セキュリティ │ 💴敷金/礼金   │
│ ${propertyDetails.pet} │ ${propertyDetails.security} │ ${propertyDetails.deposit} │
├──────────────┴──────────────┴──────────────┤
│  🏢 ${propertyDetails.company} 📞 お問い合わせ  │
└────────────────────────────────────────────┘

- 3カラムのグリッドレイアウト
- 上部に写真ギャラリー
- 下部に情報グリッド
- 整然とした印象`;
            }
            
            // スタッフ写真がある場合の追加指示
            const staffInstructions = options.staffPhoto ? `
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
` : '';

            // 複数画像使用の指示
            const multiImageInstructions = options.propertyImages.length > 1 ? `
════════════════════════════════════════════════════════
【複数画像の使用 - 重要】
════════════════════════════════════════════════════════
提供された${options.propertyImages.length}枚の物件写真を全て使用してください。
- メイン写真を大きく配置
- サブ写真を小さく複数配置（コラージュ風またはギャラリー風）
- 全ての写真が見えるようにレイアウト
` : '';

            prompt = `
日本語の不動産提案書用インフォグラフィックを作成してください。
ビジネス提案書や紙資料に使える、プロフェッショナルなデザインです。
${options.staffPhoto ? 'スタッフが物件を紹介するスタイルで作成してください。' : ''}

════════════════════════════════════════════════════════
【物件データ】
════════════════════════════════════════════════════════
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
「${propertyDetails.title}」
「${propertyDetails.price}」
「${propertyDetails.layout}」
「${propertyDetails.address}」
「${propertyDetails.parking}」
「${propertyDetails.company}」
「お問い合わせはこちら」
${options.staffPhoto ? '+ スタッフ吹き出し: 物件の魅力を表す短いコメント（AIが物件データから生成、10文字以内）' : ''}

【重要】
- 全テキストは正確な日本語で表示
- 文字化けなし
- 印刷可能な品質
- アスペクト比: ${options.aspectRatio}
${options.staffPhoto ? '- スタッフ写真を必ず含め、吹き出しには物件の魅力を表すコメントを生成' : ''}
${options.propertyImages.length > 1 ? `- 提供された${options.propertyImages.length}枚の物件写真を全て使用` : ''}
`;
        }
        // ===== スタンダードテンプレート（モード別処理） =====
        else if (template === 'standard') {
            console.log(`Using standard template with mode: ${options.mode}`);
            
            // モード別のレイアウト指示
            let modeInstructions = '';
            if (options.mode === 'youtube') {
                modeInstructions = `
【YouTubeサムネイル風レイアウト】
- 16:9のワイドフォーマット
- 大きく目を引くタイトル文字（太字、縁取り付き）
- 物件写真を背景全面に配置
- 価格を目立つ位置に大きく表示（黄色やオレンジなどの注目色）
- 「詳細はこちら」などのCTAテキスト`;
            } else if (options.mode === 'stories') {
                modeInstructions = `
【Instagramストーリーズ風レイアウト】
- 9:16の縦長フォーマット
- 物件写真を全面に配置
- 上部にタイトル、中央に価格
- 下部に「スワイプアップ」などのCTAエリア
- ストーリーズに適したポップなデザイン`;
            } else if (options.mode === 'instagram') {
                modeInstructions = `
【Instagram投稿風レイアウト】
- 1:1の正方形フォーマット
- 物件写真をメインに配置
- 洗練されたタイポグラフィ
- ハッシュタグ風の装飾も可
- インスタ映えするスタイリッシュなデザイン`;
            } else {
                // sns_banner（デフォルト）
                modeInstructions = `
【SNSバナー風レイアウト】
- 物件写真を背景に配置
- 上部に物件名（大きく読みやすく）
- 中央または目立つ位置に価格
- 下部に物件詳細と問い合わせボタン
- SNS広告に適したデザイン`;
            }
            
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

// ============================================
// 画像生成（URL指定・レガシー）
// ============================================
export async function generatePropertyImage(options: {
    propertyData: any;
    imageUrl: string;
    mode: 'sns_banner' | 'youtube_thumbnail' | 'document' | 'stories' | 'renovation' | 'comparison';
    size: '1K' | '2K' | '4K';
    aspectRatio: '1:1' | '16:9' | '9:16' | '4:3';
    style: string;
    includePrice?: boolean;
    includeLogo?: boolean;
    customText?: string;
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

        // Build prompt based on mode
        let prompt = '';

        switch (options.mode) {
            case 'sns_banner':
                prompt = `
Create a professional real estate social media banner image with the following specifications:

Property Information:
- Title: ${options.propertyData.title}
- Price: ${options.propertyData.price}
- Category: ${options.propertyData.category_name_ja}

Design Requirements:
- Style: ${options.style} aesthetic - ${getStyleDescription(options.style)}
- Include the property image from the URL
- Add elegant text overlay with property title and price
- Add subtle gradient overlay for text readability
- Include "お問い合わせはこちら" call-to-action button
- Professional typography with Japanese fonts
- Aspect ratio: ${options.aspectRatio}

The image should be eye-catching and professional for Instagram/Facebook posts.
`;
                break;

            case 'youtube_thumbnail':
                prompt = `
Create a compelling YouTube thumbnail for a real estate property video:

Property: ${options.propertyData.title}
Price: ${options.propertyData.price}

Design Requirements:
- 16:9 aspect ratio optimized for YouTube
- Large, bold text that's readable even at small sizes
- Use the property image as background
- Add dramatic lighting and contrast
- Include price in a prominent badge/banner
- Add "新着物件" or "必見" badge
- ${options.style} design style
- High contrast for visibility

Make it click-worthy and professional.
`;
                break;

            case 'document':
                prompt = `
Create a professional A4-sized real estate property document/flyer:

Property Details:
${JSON.stringify(options.propertyData.property_data, null, 2)}

Design Requirements:
- Clean, professional layout suitable for printing
- Include property photo prominently
- Add detailed property information in organized sections
- Use ${options.style} design aesthetic
- Include company branding area
- Add QR code placeholder
- Professional typography
- 4:3 aspect ratio (A4 proportions)

Create a comprehensive property information sheet.
`;
                break;

            case 'stories':
                prompt = `
Create a vertical Instagram/LINE Stories image for real estate:

Property: ${options.propertyData.title}
Price: ${options.propertyData.price}

Design Requirements:
- 9:16 vertical aspect ratio
- Mobile-optimized design
- Property image as background with gradient overlay
- Large, readable text for mobile viewing
- Include swipe-up call-to-action
- ${options.style} aesthetic
- Add interactive elements (arrows, buttons)
- Optimized for quick viewing

Make it engaging for mobile users.
`;
                break;

            case 'renovation':
                prompt = `
Create a renovation visualization showing potential improvements:

Current Property: ${options.propertyData.title}

Design Requirements:
- Show the property with modern renovations applied
- ${options.style} interior design style
- Enhance lighting and atmosphere
- Add modern furniture and decor
- Improve color palette
- Show potential of the space
- Professional architectural visualization quality

Create an aspirational "after renovation" image.
`;
                break;

            case 'comparison':
                prompt = `
Create a before/after comparison image:

Property: ${options.propertyData.title}

Design Requirements:
- Split-screen or side-by-side layout
- Left: Current state
- Right: Renovated/improved version
- Clear "Before" and "After" labels
- ${options.style} design for the "after" side
- Professional presentation
- Add subtle divider line
- Include price and improvement highlights

Show the transformation potential clearly.
`;
                break;
        }

        if (options.customText) {
            prompt += `\n\nAdditional Instructions: ${options.customText}`;
        }

        // Add aspect ratio and size to the prompt instead of config
        prompt += `\n\nImage specifications: ${options.size} resolution, ${options.aspectRatio} aspect ratio.`;

        const parts: any[] = [{ text: prompt }];

        // If we have an image URL, include it
        if (options.imageUrl) {
            parts.push({
                text: `Use this property image as the base: ${options.imageUrl}`
            });
        }

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
                    };
                }
            }
        }

        throw new Error('No image generated');
    } catch (error) {
        console.error('Image Generation Error:', error);
        throw error;
    }
}
