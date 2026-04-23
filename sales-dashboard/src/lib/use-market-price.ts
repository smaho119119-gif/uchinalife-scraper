'use client';

import { useCallback, useRef, useState } from 'react';

/**
 * Result shape returned by `/api/sales/market-price`.
 * Mirrors the existing component contract — keep in sync with the
 * Supabase RPC response and the route handler.
 */
export interface MarketPriceResult {
    stats: {
        avg: number;
        median: number;
        min: number;
        max: number;
        count: number;
    };
    tsuboStats?: {
        avgPerTsubo: number;
        medianPerTsubo: number;
    };
    histogram: { range: string; count: number }[];
    areaComparison: {
        area: string;
        count: number;
        avg: number;
        median: number;
        min: number;
        max: number;
    }[];
}

export interface MarketPriceQuery {
    area: string;
    category: string;
    madori?: string;
    ageMax?: number;
}

interface UseMarketPriceSearchResult {
    result: MarketPriceResult | null;
    loading: boolean;
    error: string;
    search: (query: MarketPriceQuery) => Promise<void>;
    reset: () => void;
}

/**
 * Calls `/api/sales/market-price` with cancellation safety.
 *
 * - Aborts any in-flight request when a new search starts (prevents
 *   stale data from overwriting fresh results).
 * - Aborts on unmount via the same controller pattern.
 * - Surfaces server-provided error messages so the UI can show them.
 */
export function useMarketPriceSearch(): UseMarketPriceSearchResult {
    const [result, setResult] = useState<MarketPriceResult | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const abortRef = useRef<AbortController | null>(null);

    const reset = useCallback(() => {
        abortRef.current?.abort();
        abortRef.current = null;
        setResult(null);
        setError('');
        setLoading(false);
    }, []);

    const search = useCallback(async (query: MarketPriceQuery) => {
        if (!query.area || !query.category) return;

        abortRef.current?.abort();
        const ctrl = new AbortController();
        abortRef.current = ctrl;

        setLoading(true);
        setError('');
        setResult(null);

        try {
            const params = new URLSearchParams({
                area: query.area,
                category: query.category,
            });
            if (query.madori) params.set('madori', query.madori);
            if (query.ageMax !== undefined && query.ageMax > 0) {
                params.set('age_max', String(query.ageMax));
            }

            const res = await fetch(`/api/sales/market-price?${params.toString()}`, {
                signal: ctrl.signal,
            });
            if (!res.ok) {
                const body = await res.json().catch(() => ({}));
                throw new Error(
                    (body as { error?: string }).error ?? `検索に失敗しました (${res.status})`,
                );
            }
            const data = (await res.json()) as MarketPriceResult;
            if (ctrl.signal.aborted) return;
            setResult(data);
        } catch (err: unknown) {
            if (ctrl.signal.aborted || (err instanceof Error && err.name === 'AbortError')) return;
            setError(err instanceof Error ? err.message : 'エラーが発生しました');
        } finally {
            if (!ctrl.signal.aborted) setLoading(false);
        }
    }, []);

    return { result, loading, error, search, reset };
}
