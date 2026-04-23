/**
 * Sales-copy prompt template.
 *
 * Kept in `src/prompts/` so prompt tweaks are reviewed independently of
 * orchestration logic in `lib/ai.ts`. The function is a pure builder —
 * no I/O — which keeps it trivially unit-testable.
 *
 * Property is typed as `Record<string, unknown>` for now; once the
 * scraper-side schema is locked we can swap in the real `Property` type
 * from `lib/types`.
 */

export interface SalesCopyPropertyInput {
    title?: unknown;
    price?: unknown;
    category_name_ja?: unknown;
    genre_name_ja?: unknown;
    company_name?: unknown;
    property_data?: unknown;
}

export function buildSalesCopyPrompt(property: SalesCopyPropertyInput): string {
    const title = String(property.title ?? '');
    const price = String(property.price ?? '');
    const category = String(property.category_name_ja ?? '');
    const genre = String(property.genre_name_ja ?? '');
    const company = String(property.company_name ?? '');
    const detailsJson = JSON.stringify(property.property_data ?? {}, null, 2);

    return `
あなたはトップクラスの不動産営業マンです。以下の物件情報をもとに、
魅力的で説得力のあるセールスコピーを作成してください。

物件情報:
- タイトル: ${title}
- 価格: ${price}
- カテゴリ: ${category} / ${genre}
- 会社: ${company}
- 詳細: ${detailsJson}

以下の要素を含めてください:
1. キャッチコピー（目を引く一文）
2. 物件の主要な魅力ポイント（3-5点）
3. ターゲット層への訴求
4. 行動喚起（CTA）

Markdown形式で、見出しや箇条書きを使って読みやすく作成してください。
`;
}
