/**
 * Single source of truth for property categories.
 * All API routes, components, and helpers must import from here.
 */

export const RENTAL_CATEGORIES = ['jukyo', 'jigyo', 'parking', 'yard'] as const;
export const SALE_CATEGORIES = ['house', 'mansion', 'tochi', 'sonota'] as const;
export const ALL_CATEGORIES = [...RENTAL_CATEGORIES, ...SALE_CATEGORIES] as const;

export type CategoryId = (typeof ALL_CATEGORIES)[number];

export const CATEGORY_NAMES_JA: Record<CategoryId, string> = {
    jukyo: '賃貸_住居',
    jigyo: '賃貸_事業用',
    parking: '賃貸_時間貸駐車場',
    yard: '賃貸_月極駐車場',
    house: '売買_戸建',
    mansion: '売買_マンション',
    tochi: '売買_土地',
    sonota: '売買_その他',
};

export const CATEGORY_TO_TYPE: Record<CategoryId, '賃貸' | '売買'> = {
    jukyo: '賃貸',
    jigyo: '賃貸',
    parking: '賃貸',
    yard: '賃貸',
    house: '売買',
    mansion: '売買',
    tochi: '売買',
    sonota: '売買',
};

export function isRentalCategory(c: string): boolean {
    return (RENTAL_CATEGORIES as readonly string[]).includes(c);
}

export function isValidCategory(c: string): c is CategoryId {
    return (ALL_CATEGORIES as readonly string[]).includes(c);
}
