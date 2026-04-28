'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

interface UseApiState<T> {
    data: T | null;
    error: string | null;
    loading: boolean;
}

interface UseApiResult<T> extends UseApiState<T> {
    refetch: () => void;
}

/**
 * Client-side fetch hook with built-in AbortController, error state, and loading state.
 * Cancels in-flight requests on unmount or refetch — fixes "setState after unmount" warnings
 * and stale-response races.
 *
 * Usage:
 *   const { data, error, loading } = useApi<StatsResponse>('/api/stats');
 */
export function useApi<T>(
    url: string | null,
    options?: RequestInit,
): UseApiResult<T> {
    const [state, setState] = useState<UseApiState<T>>({
        data: null,
        error: null,
        loading: !!url,
    });
    const abortRef = useRef<AbortController | null>(null);
    const [tick, setTick] = useState(0);

    useEffect(() => {
        if (!url) return;
        abortRef.current?.abort();
        const ctrl = new AbortController();
        abortRef.current = ctrl;

        setState((s) => ({ ...s, loading: true, error: null }));

        // R24: Vercel Hobby caps function duration at 10s, so cold starts on
        // heavy aggregate routes (`/api/analytics/diff`) can 500 the very
        // first hit. Auto-retry once on 5xx — second hit warms the function
        // and almost always succeeds in <2s.
        const attempt = async (retriesLeft: number): Promise<T> => {
            const res = await fetch(url, { ...options, signal: ctrl.signal });
            if (!res.ok) {
                if (res.status >= 500 && retriesLeft > 0) {
                    return attempt(retriesLeft - 1);
                }
                const body = await res.text().catch(() => '');
                throw new Error(`${res.status} ${res.statusText}${body ? `: ${body.slice(0, 200)}` : ''}`);
            }
            return res.json();
        };

        attempt(1)
            .then((data: T) => {
                if (ctrl.signal.aborted) return;
                setState({ data, error: null, loading: false });
            })
            .catch((err: unknown) => {
                if (ctrl.signal.aborted || (err instanceof Error && err.name === 'AbortError')) return;
                const message = err instanceof Error ? err.message : 'データの取得に失敗しました';
                setState({ data: null, error: message, loading: false });
            });

        return () => ctrl.abort();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [url, tick]);

    const refetch = useCallback(() => setTick((t) => t + 1), []);
    return { ...state, refetch };
}
