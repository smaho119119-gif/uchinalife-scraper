/**
 * Shared types for the Admin page and its sub-components.
 * Extracted from page.tsx during the Round 3 split so that panels can
 * import only what they need without pulling in the entire page module.
 */

export interface Stats {
    total: number;
    active: number;
    categories: Record<string, number>;
    lastUpdated: string;
}

export interface GitHubWorkflow {
    id: number;
    name: string;
    status: string;
    conclusion: string | null;
    created_at: string;
    updated_at: string;
    html_url: string;
    run_number: number;
    event: string;
    run_started_at: string;
    workflow_id: number;
    path?: string;
}

export interface ScrapingConfig {
    baseUrl: string;
    maxWorkers: number;
    itemsPerPage: number;
    maxPagesPerCategory: number;
    headlessMode: boolean;
    maxRequestsPerSecond: number;
    maxRetries: number;
    categories: { id: string; name: string; url: string }[];
}

export interface ScrapingInfo {
    config: ScrapingConfig;
    schedule: {
        daily: { enabled: boolean; time: string; description: string };
        timeout: number;
    };
    logFiles: { name: string; date: string; size: string }[];
    lastSuccess: string | null;
    checkpoint: unknown;
}

export interface ScrapingStatus {
    isRunning: boolean;
    pids: string[];
    message: string;
}

export interface LogData {
    filename: string;
    logs: string;
    totalLines: number;
}

export interface ScrapingProgress {
    phase: 'collecting' | 'scraping' | 'completed' | 'unknown';
    currentCategory: string;
    currentPage: number;
    collectedLinks: number;
    processedItems: number;
    totalItems: number;
    totalProcessed: number;
    checkpointProcessed: number;
    categoryProgress: { id: string; name: string; links: number; processed: number; total: number }[];
    currentLog: string;
    startTime: string | null;
}

export interface CalendarDay {
    date: string;
    hasLog: boolean;
    logFile: string | null;
    success: boolean;
    totalLinks: number;
    totalProcessed: number;
    categories: Record<string, number>;
    githubAction?: {
        runNumber: number;
        status: string;
        conclusion: string | null;
        htmlUrl: string;
        runStartedAt: string;
        updatedAt: string;
    };
    dataSources?: {
        supabase: { saved: boolean; count: number };
        sqlite: { saved: boolean; fileExists: boolean };
        csv: { saved: boolean; files: string[] };
    };
}

export interface CalendarData {
    year: number;
    month: number;
    days: CalendarDay[];
    summary: {
        totalDays: number;
        daysWithLogs: number;
        successDays: number;
        totalLinksCollected: number;
    };
}

export interface DayDetails {
    date: string;
    hasSuccess: boolean;
    logs: {
        filename: string;
        size: string;
        createdAt: string;
        lineCount: number;
        preview: string;
        stats: { totalLinks: number; totalProcessed: number; categories: Record<string, number> };
    }[];
    githubAction?: {
        runNumber: number;
        status: string;
        conclusion: string | null;
        htmlUrl: string;
        runStartedAt: string;
        updatedAt: string;
    };
    dataSources?: {
        supabase: { saved: boolean; count: number };
        sqlite: { saved: boolean; fileExists: boolean };
        csv: { saved: boolean; files: string[] };
    };
    diagnosis?: {
        issue: string;
        severity: 'error' | 'warning' | 'info';
        message: string;
        solution: string;
    }[];
    summary: { totalLinks: number; totalProcessed: number; categories: Record<string, number> } | null;
}

export interface GeneratedImageItem {
    id: number;
    property_url: string;
    image_url: string;
    filename: string;
    mode: string;
    style: string;
    size: string;
    aspect_ratio: string;
    created_at: string;
    file_exists: boolean;
}
