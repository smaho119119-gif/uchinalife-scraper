'use client';

import { useEffect, useState, useRef } from 'react';

/**
 * Resolves human-readable titles for a list of property URLs.
 *
 * - Fetches only the URLs we don't already have a title for, so adding one
 *   property doesn't refetch the whole list.
 * - Cancels in-flight requests on unmount or when the URL list changes.
 * - Failures are silent — the UI falls back to the URL itself.
 */
export function usePropertyTitles(urls: string[]): Record<string, string> {
    const [titles, setTitles] = useState<Record<string, string>>({});
    const titlesRef = useRef(titles);
    titlesRef.current = titles;

    useEffect(() => {
        if (urls.length === 0) return;
        const missing = urls.filter((u) => !titlesRef.current[u]);
        if (missing.length === 0) return;

        const ctrl = new AbortController();
        const encoded = missing.map((u) => encodeURIComponent(u)).join(',');

        fetch(`/api/sales/proposal?urls=${encoded}`, { signal: ctrl.signal })
            .then((res) => (res.ok ? res.json() : []))
            .then((data: Array<{ url: string; title: string }>) => {
                if (!Array.isArray(data) || data.length === 0) return;
                setTitles((prev) => {
                    const next = { ...prev };
                    for (const p of data) next[p.url] = p.title;
                    return next;
                });
            })
            .catch(() => {
                /* ignore */
            });

        return () => ctrl.abort();
        // We deliberately depend on the URL set only, so re-renders that don't
        // change the set don't refire.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [urls.join('|')]);

    return titles;
}
