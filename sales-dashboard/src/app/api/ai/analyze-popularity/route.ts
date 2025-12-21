import { supabase } from '@/lib/supabase';
import { GoogleGenerativeAI } from "@google/generative-ai";
import OpenAI from "openai";
import { NextResponse } from 'next/server';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || '' });

// 人気分析用のモデル定義
const ANALYSIS_MODELS = {
    'gemini-3-pro': {
        id: 'gemini-3-pro-preview',
        name: 'Gemini 3 Pro',
        provider: 'google',
    },
    'gemini-2.5-flash': {
        id: 'gemini-2.5-flash-preview-05-20',
        name: 'Gemini 2.5 Flash',
        provider: 'google',
    },
    'gpt-4o-mini': {
        id: 'gpt-4o-mini',
        name: 'GPT-4o Mini',
        provider: 'openai',
    },
} as const;

type ModelKey = keyof typeof ANALYSIS_MODELS;

export async function POST(request: Request) {
    try {
        const { url, model } = await request.json();
        const modelKey = (model || 'gemini-3-pro') as ModelKey;
        const modelConfig = ANALYSIS_MODELS[modelKey];
        
        // Supabaseから物件を取得
        const { data: property, error: propertyError } = await supabase
            .from('properties')
            .select('*')
            .eq('url', url)
            .single();

        if (propertyError || !property) {
            console.error('Property not found:', propertyError);
            return NextResponse.json({ error: 'Property not found' }, { status: 404 });
        }

        const propertyData = {
            ...property,
            images: typeof property.images === 'string' ? JSON.parse(property.images || '[]') : (property.images || []),
            property_data: typeof property.property_data === 'string' ? JSON.parse(property.property_data || '{}') : (property.property_data || {}),
        };

        // 地域の相場データを取得（同じエリアの物件）
        const pd = propertyData.property_data || {};
        const address = pd['所在地'] || pd['住所'] || property.address || '';
        
        // 市区町村を抽出（例: 「那覇市」「糸満市」など）
        const cityMatch = address.match(/([\u4e00-\u9fa5]+[市町村区])/);
        const city = cityMatch ? cityMatch[1] : '';
        
        let similarProperties: any[] = [];
        let avgPrice = 0;
        let minPrice = 0;
        let maxPrice = 0;
        
        if (city) {
            // 同じカテゴリ・地域の物件を検索（Supabase）
            const { data: similarData } = await supabase
                .from('properties')
                .select('price, property_data')
                .eq('is_active', true)
                .eq('category', property.category)
                .ilike('address', `%${city}%`)
                .limit(50);
            
            similarProperties = similarData || [];
            
            // 価格分析
            const prices = similarProperties
                .map(p => {
                    const priceStr = p.price || '';
                    const match = priceStr.match(/([\d,]+)\s*(万|円)/);
                    if (match) {
                        const num = parseFloat(match[1].replace(/,/g, ''));
                        return match[2] === '万' ? num * 10000 : num;
                    }
                    return 0;
                })
                .filter(p => p > 0);
            
            if (prices.length > 0) {
                avgPrice = prices.reduce((a, b) => a + b, 0) / prices.length;
                minPrice = Math.min(...prices);
                maxPrice = Math.max(...prices);
            }
        }

        // 物件価格を抽出
        const priceStr = pd['家賃'] || pd['価格'] || propertyData.price || '';
        const currentPriceMatch = priceStr.match(/([\d,.]+)\s*(万|円)/);
        let currentPrice = 0;
        if (currentPriceMatch) {
            currentPrice = parseFloat(currentPriceMatch[1].replace(/,/g, ''));
            if (currentPriceMatch[2] === '万') currentPrice *= 10000;
        }

        // 価格の位置づけを計算
        let pricePosition = '平均的';
        if (avgPrice > 0 && currentPrice > 0) {
            const ratio = currentPrice / avgPrice;
            if (ratio < 0.85) pricePosition = '相場より安い（お得）';
            else if (ratio < 0.95) pricePosition = 'やや安め';
            else if (ratio > 1.15) pricePosition = '相場より高め';
            else if (ratio > 1.05) pricePosition = 'やや高め';
        }

        // 物件の特徴を分析
        const features = {
            layout: pd['間取り'] || '',
            deposit: pd['敷金／礼金'] || pd['敷金'] || '',
            parking: pd['駐車場'] || '',
            pet: pd['ペット'] || '',
            security: pd['セキュリティ'] || '',
            equipment: pd['家具・家電'] || pd['設備'] || '',
            bath: pd['バス・トイレ'] || '',
            kitchen: pd['キッチン'] || '',
            storage: pd['収納'] || '',
            internet: pd['放送・通信'] || '',
            building: pd['建物構造'] || '',
            school: pd['小学校'] || pd['学校区'] || '',
            kindergarten: pd['幼稚園'] || pd['保育園'] || '',
            juniorHigh: pd['中学校'] || '',
            hospital: pd['病院'] || pd['医療機関'] || '',
            supermarket: pd['スーパー'] || pd['買い物'] || '',
            convenience: pd['コンビニ'] || '',
            station: pd['最寄り駅'] || pd['バス停'] || pd['交通'] || '',
            other: pd['その他条件'] || '',
            remarks: pd['備考'] || '',
            周辺施設: pd['周辺施設'] || pd['周辺環境'] || '',
            特記事項: pd['特記事項'] || '',
        };

        // 海の近くかどうかを判定（住所や備考から）
        const allText = `${address} ${features.remarks} ${features.周辺施設} ${features.特記事項}`;
        const nearOcean = /海|ビーチ|オーシャン|マリン|港|漁港|海岸|浜/.test(allText);
        const nearPark = /公園|緑地|運動場/.test(allText);
        const nearConvenience = /コンビニ|ローソン|ファミマ|セブン/.test(allText);
        const nearSupermarket = /スーパー|サンエー|イオン|マックスバリュ|ユニオン|かねひで|りうぼう|ビッグワン/.test(allText);

        // 人気ポイントを特定
        const popularPoints: string[] = [];
        
        // 駐車場
        if (features.parking && !features.parking.includes('なし') && !features.parking.includes('無')) {
            popularPoints.push(`🚗 駐車場あり（${features.parking}）`);
        } else if (!features.parking || features.parking.includes('なし')) {
            popularPoints.push('🚗 駐車場なし（沖縄では要注意）');
        }
        
        // ペット
        if (features.pet && (features.pet.includes('可') || features.pet.includes('OK'))) {
            popularPoints.push('🐕 ペット可（希少！）');
        }
        
        // 初期費用
        if (features.deposit && (features.deposit.includes('ナシ') || features.deposit.includes('なし') || features.deposit.includes('0'))) {
            popularPoints.push('💰 敷金・礼金なし');
        }
        
        // セキュリティ
        if (features.security && features.security.length > 2) {
            popularPoints.push(`🔐 セキュリティ充実（${features.security}）`);
        }
        
        // バストイレ
        if (features.bath && features.bath.includes('別')) {
            popularPoints.push('🛁 バス・トイレ別');
        }
        
        // インターネット
        if (features.internet && features.internet.length > 2) {
            popularPoints.push(`📡 インターネット環境（${features.internet}）`);
        }
        
        // 学校
        if (features.school) {
            popularPoints.push(`🏫 小学校: ${features.school}`);
        }
        if (features.juniorHigh) {
            popularPoints.push(`🏫 中学校: ${features.juniorHigh}`);
        }
        if (features.kindergarten) {
            popularPoints.push(`👶 保育園/幼稚園: ${features.kindergarten}`);
        }
        
        // 周辺施設
        if (nearOcean) {
            popularPoints.push('🌊 海の近く');
        }
        if (nearPark) {
            popularPoints.push('🌳 公園が近い');
        }
        if (nearSupermarket) {
            popularPoints.push('🛒 スーパー近く');
        }
        if (nearConvenience) {
            popularPoints.push('🏪 コンビニ近く');
        }
        if (features.hospital) {
            popularPoints.push(`🏥 病院: ${features.hospital}`);
        }
        if (features.station) {
            popularPoints.push(`🚌 交通: ${features.station}`);
        }
        if (features.equipment && features.equipment.length > 2) {
            popularPoints.push(`🏠 設備充実（${features.equipment}）`);
        }

        // 沖縄の地域特性データ
        const okinawaRegions: Record<string, string> = {
            '那覇市': '沖縄の県庁所在地。モノレール「ゆいレール」あり。国際通り、首里城が有名。都市機能が充実し、病院・学校・商業施設が集中。家賃相場は沖縄で最も高め。単身者・ファミリーに人気。',
            '浦添市': '那覇市の北隣。ベッドタウンとして発展。サンエー、イオンなど大型商業施設多数。58号線沿いは交通量多め。子育て世帯に人気。那覇へのアクセス良好。',
            '宜野湾市': '普天間基地があり、国際色豊か。コンベンションセンター周辺は発展中。58号線・330号線のアクセス良好。海沿いはリゾート感あり。',
            '北谷町': '「アメリカンビレッジ」で有名。若者・外国人に人気のおしゃれエリア。海沿いのカフェ・レストラン充実。夜の治安は要確認。家賃はやや高め。',
            '沖縄市': '嘉手納基地の東側。コザ地区は歴史ある街並み。イオンモール沖縄ライカムあり。中部の中心都市。',
            'うるま市': '具志川・石川が合併。海中道路で離島へアクセス可能。イオン具志川あり。中部では家賃比較的安め。',
            '読谷村': '沖縄一大きな村。残波岬、やちむんの里など観光名所多数。のどかな環境。車必須。家賃は安め。',
            '名護市': '北部の中心都市。美ら海水族館へのアクセス良好。21世紀の森公園など自然豊か。那覇から遠いため家賃安め。',
            '豊見城市': '那覇空港から近い。アウトレットモールあしびなーあり。発展中のベッドタウン。',
            '糸満市': '沖縄本島最南端。漁業の街。平和祈念公園あり。のどかで家賃安め。那覇へは30分程度。',
            '南城市': '斎場御嶽など聖地が点在。自然豊かで静か。ニライカナイ橋からの絶景。車必須。',
            '西原町': '琉球大学があり学生多い。那覇・中部どちらへもアクセス良好。家賃は手頃。',
            '中城村': '中城城跡で有名。イオンモール沖縄ライカムに近い。静かな住宅地。',
            '北中城村': 'イオンモール沖縄ライカムがある。発展中。58号線アクセス良好。',
            '恩納村': 'リゾートエリア。万座毛、真栄田岬など観光名所。ホテル・リゾート施設多数。',
            '金武町': 'キャンプハンセン隣接。タコライス発祥の地。自然豊か。',
            '南風原町': '那覇市に隣接するベッドタウン。南風原イオンあり。交通便利。',
            '与那原町': '与那原東区は古い街並み。那覇へのアクセス良好。',
            '八重瀬町': '南部ののどかなエリア。具志頭、東風平が合併。家賃安め。',
        };

        const regionInfo = city ? (okinawaRegions[city] || `${city}エリア。沖縄らしい生活が楽しめる地域。`) : '';

        // プロンプトを構築
        const prompt = `
あなたは沖縄で20年以上の実績を持つトップセールスマンです。
お客様に物件を紹介する際、**正直に**メリット・デメリット両方を伝え、
他の競合物件と比較しながら、この物件の価値を説明してください。

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 【分析対象物件】
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
物件名: ${propertyData.title}
価格: ${priceStr}
間取り: ${features.layout}
所在地: ${address}
カテゴリ: ${propertyData.category_name_ja} / ${propertyData.genre_name_ja}

【生活インフラ - 重要度高】
🚗 駐車場: ${features.parking || '記載なし'} ${!features.parking || features.parking.includes('なし') ? '⚠️沖縄は車社会！' : ''}
🐕 ペット: ${features.pet || '記載なし'}
🔐 セキュリティ: ${features.security || '記載なし'}
🛁 バス・トイレ: ${features.bath || '記載なし'}
🏠 設備: ${features.equipment || '記載なし'}
🏗️ 建物構造: ${features.building || '記載なし'}
💵 敷金/礼金: ${features.deposit || '記載なし'}

【周辺環境・生活利便性 - 判断重要！】
🏫 小学校: ${features.school || '記載なし'}
🏫 中学校: ${features.juniorHigh || '記載なし'}
👶 保育園/幼稚園: ${features.kindergarten || '記載なし'}
🛒 スーパー: ${features.supermarket || '記載なし'} ${nearSupermarket ? '✅近くにあり' : ''}
🏪 コンビニ: ${features.convenience || '記載なし'} ${nearConvenience ? '✅近くにあり' : ''}
🏥 病院: ${features.hospital || '記載なし'}
🚌 交通: ${features.station || '記載なし'}
🌊 海の近く: ${nearOcean ? 'YES - 海近物件！' : '不明'}
🌳 公園: ${nearPark ? '近くにあり' : '記載なし'}

【その他・備考】
${features.other || 'なし'}
${features.remarks || ''}
${features.周辺施設 || ''}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 【相場データ】
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
エリア: ${city || '沖縄県'}
同エリア・同カテゴリ物件数: ${similarProperties.length}件
平均価格: ${avgPrice > 0 ? Math.round(avgPrice).toLocaleString() + '円' : 'データなし'}
最低〜最高: ${minPrice > 0 ? Math.round(minPrice).toLocaleString() : '-'} 〜 ${maxPrice > 0 ? Math.round(maxPrice).toLocaleString() : '-'}円
この物件の価格位置: **${pricePosition}**

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🗺️ 【${city || '沖縄'}エリアの特徴】
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${regionInfo}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✨ 【この物件の特徴】
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${popularPoints.length > 0 ? popularPoints.join('\n') : '特記事項なし'}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
【出力形式】以下の形式で、実践的なセールス資料を作成してください
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## 🎯 結論（この物件は買い？待ち？）

（率直な意見を最初に。お客様が一番知りたいこと）

## ✅ この物件のメリット【5つ】

（他の競合物件と比較して、この物件が優れている点を具体的に）
- 各ポイントで「**他の物件では〜だが、この物件は〜**」という比較形式で説明

## ⚠️ 正直に伝えるデメリット【3つ】

（隠さず正直に伝える。ただし、フォローも添える）
- デメリット → でも、こういう方には問題ない / こう対策できる

## 📍 ${city || '沖縄'}エリア徹底解説

（この地域に住むとどんな生活になるか、リアルに描写）
- 通勤・通学の便（那覇まで何分？渋滞は？）
- 買い物・病院・飲食店の充実度
- 治安・騒音（基地の影響は？）
- 子育て環境（学校・公園・病院）
- 観光客・米軍関係者の多さ

## 🏪 周辺施設チェック【立地評価】

（5段階で評価 ★★★★★）
- 🛒 買い物の便: （最寄りスーパー、距離、品揃え）
- 🏫 教育環境: （学校区の評判、塾、習い事）
- 🏥 医療: （病院、小児科、救急対応）
- 🌊 海・自然: （ビーチまで何分？公園は？）
- 🚗 駐車場: （台数、月額、来客用は？）
- 🚌 公共交通: （バス停、モノレール駅まで）

## 💰 価格の妥当性

（相場と比較して高いのか安いのか、その理由）
- 「${pricePosition}」である理由
- 初期費用の総額試算
- 周辺の競合物件との比較

## 👤 こんなお客様におすすめ！

（ペルソナを3パターン具体的に）

## 🚫 こんな方には合わないかも

（正直に合わない人も伝える。ミスマッチ防止）

## 💬 実践セールストーク

【オープニング】
「〇〇様、本日ご紹介するのは〜」から始まる具体的なトーク

【クロージング】
決め手となる一言、背中を押すフレーズ

【想定Q&A】
お客様からよくある質問3つと、その回答例

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
重要：
- 「はい、かしこまりました」などの前置き・挨拶は一切不要。いきなり本題から始める。
- **太字**や*斜体*などのマークダウン記法は使わない。プレーンテキストで書く。
- 嘘や誇張は絶対NG。正直に。
- 沖縄の地域性（車社会、台風、湿気、基地問題など）を考慮
- 具体的な数字・事実ベースで説明
- お客様目線で「本当に住みやすいか」を判断
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`;

        console.log(`Generating popularity analysis with model: ${modelKey}`);

        let analysis = '';
        let actualModelUsed = modelConfig.name;
        
        // フォールバック順序: Gemini 3 Pro → Gemini 2.5 Flash → GPT-4o Mini
        const fallbackModels = [
            { id: modelConfig.id, name: modelConfig.name, provider: modelConfig.provider },
            { id: 'gemini-2.5-flash-preview-05-20', name: 'Gemini 2.5 Flash (Fallback)', provider: 'google' },
            { id: 'gpt-4o-mini', name: 'GPT-4o Mini (Fallback)', provider: 'openai' },
        ];
        
        for (const fallbackModel of fallbackModels) {
            try {
                console.log(`Trying model: ${fallbackModel.name}`);
                
                if (fallbackModel.provider === 'openai') {
                    const response = await openai.chat.completions.create({
                        model: fallbackModel.id,
                        messages: [{ role: 'user', content: prompt }],
                        temperature: 0.7,
                    });
                    analysis = response.choices[0]?.message?.content || '';
                } else {
                    const model = genAI.getGenerativeModel({ model: fallbackModel.id });
                    const result = await model.generateContent(prompt);
                    const response = await result.response;
                    analysis = response.text();
                }
                
                actualModelUsed = fallbackModel.name;
                console.log(`Successfully generated with: ${actualModelUsed}`);
                break; // 成功したらループを抜ける
                
            } catch (modelError: any) {
                console.error(`Model ${fallbackModel.name} failed:`, modelError?.message || modelError);
                // 503エラーまたはモデルオーバーロードの場合は次のモデルを試す
                if (modelError?.status === 503 || modelError?.message?.includes('overloaded')) {
                    console.log(`Model ${fallbackModel.name} is overloaded, trying next fallback...`);
                    continue;
                }
                // それ以外のエラーは次のモデルを試す
                continue;
            }
        }
        
        if (!analysis) {
            return NextResponse.json({ 
                error: 'すべてのAIモデルが現在利用できません。しばらく待ってから再試行してください。' 
            }, { status: 503 });
        }

        // 追加の統計情報
        const stats = {
            city,
            similarCount: similarProperties.length,
            avgPrice: avgPrice > 0 ? Math.round(avgPrice) : null,
            minPrice: minPrice > 0 ? Math.round(minPrice) : null,
            maxPrice: maxPrice > 0 ? Math.round(maxPrice) : null,
            pricePosition,
            currentPrice: currentPrice > 0 ? Math.round(currentPrice) : null,
            popularPoints,
        };

        return NextResponse.json({ 
            analysis,
            stats,
            modelUsed: actualModelUsed,
        });
    } catch (error) {
        console.error('AI Analysis Error:', error);
        return NextResponse.json({ error: 'Failed to generate analysis' }, { status: 500 });
    }
}

