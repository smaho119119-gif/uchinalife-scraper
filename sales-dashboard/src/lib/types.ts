/**
 * Shared domain types. Single source of truth.
 *
 * History: until Round 2 these were duplicated across lib/db.ts, lib/supabase.ts,
 * and lib/index.ts. They now live here; the legacy modules re-export from this file
 * to keep existing imports working while we migrate.
 */

export interface Property {
    url: string;
    category: string;
    category_type: string;
    category_name_ja: string;
    genre_name_ja: string;
    title: string;
    price: string;
    favorites: number;
    update_date: string;
    expiry_date: string;
    images: string[];
    company_name: string;
    /**
     * Free-form key/value pairs scraped from the listing detail page.
     * Keys are Japanese; values are strings. Stored as JSONB in Supabase.
     */
    property_data: Record<string, string>;
    is_active: boolean;
    first_seen_date: string;
    last_seen_date: string;
}

export interface StaffPhoto {
    id: string;
    name: string;
    data_url: string;
    created_at: string;
}

export interface GeneratedImage {
    id: number;
    property_url: string;
    image_url: string;
    filename: string;
    mode: string;
    style: string;
    size: string;
    aspect_ratio: string;
    created_at: string;
}
