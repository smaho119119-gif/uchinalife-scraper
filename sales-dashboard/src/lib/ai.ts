import { GoogleGenerativeAI } from "@google/generative-ai";
import OpenAI from "openai";
import { getStyleDescription } from "@/lib/ai-styles";
import { buildSalesCopyPrompt } from "@/prompts/sales-copy";
import {
    extractPropertyDetails,
    buildPropertyHighlights,
    type PropertyInputForPrompt,
} from "@/prompts/property-fields";
import {
    buildProposalImagePrompt,
    parseProposalTemplate,
    buildStandardImagePrompt,
    buildCollageImagePrompt,
    isCollageTemplate,
    buildBusinessDocumentPrompt,
    buildInfographicPrompt,
    buildStaffOnlyPrompt,
    buildDefaultImagePrompt,
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
    property: PropertyInputForPrompt,
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
    propertyData: PropertyInputForPrompt;
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
        

        // ===== 提案書テンプレート（紙資料用） =====
        if (template.startsWith('proposal_')) {
            const proposalType = parseProposalTemplate(template);
            if (proposalType) {
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
            prompt = buildStandardImagePrompt({
                propertyDetails,
                modeInstructions: getStandardModeInstructions(options.mode),
                styleDescription: getStyleDescription(options.style),
                propertyImageCount: options.propertyImages.length,
                hasStaffPhoto: !!options.staffPhoto,
                aspectRatio: options.aspectRatio,
            });
        }
        // ===== コラージュ・雑誌風・オーバーレイテンプレート =====
        else if (isCollageTemplate(template)) {
            prompt = buildCollageImagePrompt({
                template,
                propertyDetails,
                styleDescription: getStyleDescription(options.style),
                propertyImageCount: options.propertyImages.length,
                hasStaffPhoto: !!options.staffPhoto,
                aspectRatio: options.aspectRatio,
            });
        }
        else if (options.mode === 'document' && options.style === 'business') {
            prompt = buildBusinessDocumentPrompt({
                propertyDetails,
                aspectRatio: options.aspectRatio,
                hasStaffPhoto: !!options.staffPhoto,
            });
        } else if (options.mode === 'infographic') {
            prompt = buildInfographicPrompt({
                propertyDetails,
                aspectRatio: options.aspectRatio,
                hasStaffPhoto: !!options.staffPhoto,
            });
        } else if (options.staffPhoto) {
            prompt = buildStaffOnlyPrompt({
                propertyDetails,
                propertyImageCount: options.propertyImages.length,
                styleDescription: getStyleDescription(options.style),
                aspectRatio: options.aspectRatio,
            });
        } else {
            prompt = buildDefaultImagePrompt({
                propertyDetails,
                highlights,
                styleDescription: getStyleDescription(options.style),
                aspectRatio: options.aspectRatio,
            });
        }

        prompt += `\n\n画像仕様: ${options.size}解像度、${options.aspectRatio}アスペクト比。`;

        // Build parts array with images
        type GeminiPart =
            | { text: string }
            | { inlineData: { data: string; mimeType: string } };
        const parts: GeminiPart[] = [{ text: prompt }];

        // Add property images
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
            parts.push({
                inlineData: {
                    data: options.staffPhoto.data,
                    mimeType: options.staffPhoto.mimeType
                }
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
