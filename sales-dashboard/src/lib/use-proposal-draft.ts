'use client';

import { useEffect, useState } from 'react';

export interface ProposalDraft {
    clientName: string;
    clientCompany: string;
    notes: string;
    propertyUrls: string[];
    includeMarketData: boolean;
}

const STORAGE_KEY = 'uchina-proposal-draft';

const EMPTY_DRAFT: ProposalDraft = {
    clientName: '',
    clientCompany: '',
    notes: '',
    propertyUrls: [],
    includeMarketData: false,
};

interface UseProposalDraftResult {
    draft: ProposalDraft;
    setClientName: (v: string) => void;
    setClientCompany: (v: string) => void;
    setNotes: (v: string) => void;
    setPropertyUrls: (v: string[] | ((prev: string[]) => string[])) => void;
    setIncludeMarketData: (v: boolean) => void;
    clear: () => void;
}

/**
 * Holds the proposal-builder form state and mirrors it into localStorage so
 * the user does not lose work on accidental refresh.
 *
 * - Loads on mount (silent on parse failure).
 * - Persists on every change (silent on quota error).
 * - `clear()` resets the form and removes the saved draft in one step.
 */
export function useProposalDraft(): UseProposalDraftResult {
    const [draft, setDraft] = useState<ProposalDraft>(EMPTY_DRAFT);
    const [hydrated, setHydrated] = useState(false);

    useEffect(() => {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved) {
                const parsed = JSON.parse(saved) as Partial<ProposalDraft>;
                setDraft({
                    clientName: parsed.clientName ?? '',
                    clientCompany: parsed.clientCompany ?? '',
                    notes: parsed.notes ?? '',
                    propertyUrls: parsed.propertyUrls ?? [],
                    includeMarketData: parsed.includeMarketData ?? false,
                });
            }
        } catch {
            /* ignore */
        }
        setHydrated(true);
    }, []);

    // Skip the very first persist so we don't overwrite an existing draft
    // with EMPTY_DRAFT before the load effect has run.
    useEffect(() => {
        if (!hydrated) return;
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
        } catch {
            /* ignore quota errors */
        }
    }, [draft, hydrated]);

    return {
        draft,
        setClientName: (v) => setDraft((d) => ({ ...d, clientName: v })),
        setClientCompany: (v) => setDraft((d) => ({ ...d, clientCompany: v })),
        setNotes: (v) => setDraft((d) => ({ ...d, notes: v })),
        setPropertyUrls: (v) =>
            setDraft((d) => ({
                ...d,
                propertyUrls: typeof v === 'function' ? v(d.propertyUrls) : v,
            })),
        setIncludeMarketData: (v) => setDraft((d) => ({ ...d, includeMarketData: v })),
        clear: () => {
            setDraft(EMPTY_DRAFT);
            try {
                localStorage.removeItem(STORAGE_KEY);
            } catch {
                /* ignore */
            }
        },
    };
}
