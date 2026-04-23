/**
 * Pure helpers for turning raw scraped property data into the fields the
 * image-generation prompts care about. Extracted so prompt builders stay
 * focused on text formatting, and so the field name → JSON key mapping
 * lives in one place (the scraper schema is Japanese).
 *
 * No I/O — easy to unit test if/when we add tests.
 */

export interface PropertyInputForPrompt {
    title?: string | null;
    price?: string | null;
    company_name?: string | null;
    property_data?: Record<string, string> | null;
}

export interface PropertyDetails {
    title: string;
    price: string;
    deposit: string;
    layout: string;
    address: string;
    parking: string;
    area: string;
    building: string;
    floor: string;
    pet: string;
    security: string;
    equipment: string;
    bath: string;
    kitchen: string;
    storage: string;
    internet: string;
    school: string;
    company: string;
    remarks: string;
}

/** Extract the curated subset of fields used by every image prompt. */
export function extractPropertyDetails(input: PropertyInputForPrompt): PropertyDetails {
    const pd = input.property_data ?? {};
    const get = (...keys: string[]) => keys.map((k) => pd[k]).find((v) => v != null && v !== '') ?? '';

    return {
        title: input.title ?? '',
        price: get('家賃', '価格') || (input.price ?? ''),
        deposit: get('敷金／礼金', '敷金'),
        layout: get('間取り'),
        address: get('所在地', '住所'),
        parking: get('駐車場'),
        area: get('専有面積', '面積'),
        building: get('建物構造'),
        floor: get('部屋番号', '階'),
        pet: get('ペット'),
        security: get('セキュリティ'),
        equipment: get('家具・家電', '設備'),
        bath: get('バス・トイレ'),
        kitchen: get('キッチン'),
        storage: get('収納'),
        internet: get('放送・通信'),
        school: get('小学校'),
        company: get('不動産会社') || (input.company_name ?? ''),
        remarks: get('備考'),
    };
}

/** Top-N highlight lines for compact prompts ("driver" UI for AI summaries). */
export function buildPropertyHighlights(d: PropertyDetails, max = 6): string[] {
    return [
        d.layout && `間取り: ${d.layout}`,
        d.price && `家賃: ${d.price}`,
        d.deposit && `敷金/礼金: ${d.deposit}`,
        d.parking && `駐車場: ${d.parking}`,
        d.security && `セキュリティ: ${d.security}`,
        d.pet && `ペット: ${d.pet}`,
    ]
        .filter((s): s is string => Boolean(s))
        .slice(0, max);
}
