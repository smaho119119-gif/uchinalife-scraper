import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  parsePrice,
  parseArea,
  calcMarketStats,
  convertM2ToTsubo,
  formatPriceShort,
  type MarketStats,
} from "@/lib/price";
import { extractCityName, getAdjacentCities } from "@/lib/area";

// ---------------------------------------------------------------------------
// Supabase client (same pattern as analytics/areas/route.ts)
// ---------------------------------------------------------------------------

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_ANON_KEY!;

// ---------------------------------------------------------------------------
// Category helpers
// ---------------------------------------------------------------------------

const VALID_CATEGORIES = new Set([
  "jukyo",
  "jigyo",
  "yard",
  "parking",
  "tochi",
  "mansion",
  "house",
  "sonota",
]);

/** Rental categories use 家賃, sale categories use 価格 */
const RENTAL_CATEGORIES = new Set(["jukyo", "jigyo", "yard", "parking"]);

function priceFieldForCategory(category: string): string {
  return RENTAL_CATEGORIES.has(category) ? "家賃" : "価格";
}

// ---------------------------------------------------------------------------
// In-memory cache (5 minutes TTL)
// ---------------------------------------------------------------------------

interface CacheEntry {
  data: unknown;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 5 * 60 * 1000;

function getCached(key: string): unknown | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  return entry.data;
}

function setCache(key: string, data: unknown): void {
  cache.set(key, { data, expiresAt: Date.now() + CACHE_TTL_MS });
}

// ---------------------------------------------------------------------------
// Building age parser
// ---------------------------------------------------------------------------

/**
 * Parse 築年月 string and return building age in years.
 * Handles formats like "2015年3月", "平成27年", "令和3年5月", "2015/03", etc.
 * Returns null if unparseable.
 */
function parseBuildingAgeYears(
  chikuNengetsu: string | null | undefined,
): number | null {
  if (!chikuNengetsu) return null;

  const str = chikuNengetsu.trim();
  if (!str || str === "不明" || str === "新築") return str === "新築" ? 0 : null;

  let builtYear: number | null = null;

  // Western year: "2015年..." or "2015/..."
  const westernMatch = str.match(/((?:19|20)\d{2})/);
  if (westernMatch) {
    builtYear = parseInt(westernMatch[1], 10);
  }

  // Japanese era years
  if (builtYear === null) {
    const eraMatch = str.match(/(令和|平成|昭和)\s*(\d{1,2})/);
    if (eraMatch) {
      const eraYear = parseInt(eraMatch[2], 10);
      switch (eraMatch[1]) {
        case "令和":
          builtYear = 2018 + eraYear;
          break;
        case "平成":
          builtYear = 1988 + eraYear;
          break;
        case "昭和":
          builtYear = 1925 + eraYear;
          break;
      }
    }
  }

  if (builtYear === null) return null;

  const currentYear = new Date().getFullYear();
  const age = currentYear - builtYear;
  return age >= 0 ? age : null;
}

// ---------------------------------------------------------------------------
// Histogram generator
// ---------------------------------------------------------------------------

interface HistogramBucket {
  range: string;
  count: number;
}

function buildHistogram(values: number[], bucketCount = 10): HistogramBucket[] {
  if (values.length === 0) return [];

  const sorted = [...values].sort((a, b) => a - b);
  const min = sorted[0];
  const max = sorted[sorted.length - 1];

  if (min === max) {
    return [{ range: formatBucketLabel(min, min), count: sorted.length }];
  }

  const bucketWidth = (max - min) / bucketCount;
  const buckets: HistogramBucket[] = [];

  for (let i = 0; i < bucketCount; i++) {
    const lo = min + bucketWidth * i;
    const hi = i === bucketCount - 1 ? max : min + bucketWidth * (i + 1);
    buckets.push({ range: formatBucketLabel(lo, hi), count: 0 });
  }

  for (const v of sorted) {
    let idx = Math.floor((v - min) / bucketWidth);
    if (idx >= bucketCount) idx = bucketCount - 1;
    buckets[idx].count++;
  }

  return buckets;
}

function formatBucketLabel(lo: number, hi: number): string {
  return `${formatCompact(lo)}-${formatCompact(hi)}`;
}

function formatCompact(value: number): string {
  if (value >= 100_000_000) {
    const oku = (value / 100_000_000).toFixed(1).replace(/\.0$/, "");
    return `${oku}億`;
  }
  if (value >= 10_000) {
    const man = Math.round(value / 10_000);
    return `${man.toLocaleString()}万`;
  }
  return `${value.toLocaleString()}`;
}

// ---------------------------------------------------------------------------
// Fetch all properties for a category with pagination
// ---------------------------------------------------------------------------

interface RawProperty {
  property_data: Record<string, string>;
}

async function fetchAllPropertiesForCategory(
  category: string,
): Promise<RawProperty[]> {
  const supabase = createClient(supabaseUrl, supabaseKey);
  const results: RawProperty[] = [];
  let from = 0;
  const pageSize = 1000;

  while (true) {
    const { data, error } = await supabase
      .from("properties")
      .select("property_data")
      .eq("is_active", true)
      .eq("category", category)
      .range(from, from + pageSize - 1);

    if (error) {
      console.error("Error fetching properties:", error);
      break;
    }

    if (!data || data.length === 0) break;

    for (const row of data) {
      const pd =
        typeof row.property_data === "string"
          ? JSON.parse(row.property_data)
          : row.property_data;
      results.push({ property_data: pd || {} });
    }

    if (data.length < pageSize) break;
    from += pageSize;
  }

  return results;
}

// ---------------------------------------------------------------------------
// Filter + extract helpers
// ---------------------------------------------------------------------------

function getLocation(pd: Record<string, string>): string {
  return pd["所在地"] || pd["住所"] || pd["location"] || "";
}

function matchesArea(pd: Record<string, string>, area: string): boolean {
  const loc = getLocation(pd);
  return loc.includes(area);
}

function matchesMadori(
  pd: Record<string, string>,
  madori: string | null,
): boolean {
  if (!madori) return true;
  const val = pd["間取り"] || "";
  return val.includes(madori);
}

function matchesAge(
  pd: Record<string, string>,
  ageMax: number | null,
): boolean {
  if (ageMax === null) return true;
  const age = parseBuildingAgeYears(pd["築年月"]);
  if (age === null) return true; // include if age unknown
  return age <= ageMax;
}

function extractAreaM2(pd: Record<string, string>): number | null {
  // Try building area first, then land area
  const raw = pd["建物面積"] || pd["専有面積"] || pd["土地面積"] || null;
  return parseArea(raw);
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const area = searchParams.get("area");
    const category = searchParams.get("category");
    const madori = searchParams.get("madori") || null;
    const ageMaxStr = searchParams.get("age_max");
    const ageMax = ageMaxStr ? parseInt(ageMaxStr, 10) : null;

    // ---- Validation ----------------------------------------------------------

    if (!area) {
      return NextResponse.json(
        { error: "area parameter is required" },
        { status: 400 },
      );
    }

    if (!category || !VALID_CATEGORIES.has(category)) {
      return NextResponse.json(
        {
          error: `category parameter is required and must be one of: ${Array.from(VALID_CATEGORIES).join(", ")}`,
        },
        { status: 400 },
      );
    }

    if (ageMax !== null && (isNaN(ageMax) || ageMax < 0)) {
      return NextResponse.json(
        { error: "age_max must be a non-negative integer" },
        { status: 400 },
      );
    }

    // ---- Cache check ---------------------------------------------------------

    const cacheKey = `market-price:${area}:${category}:${madori ?? ""}:${ageMax ?? ""}`;
    const cached = getCached(cacheKey);
    if (cached) {
      return NextResponse.json(cached);
    }

    // ---- Fetch & filter ------------------------------------------------------

    const allProps = await fetchAllPropertiesForCategory(category);

    const priceField = priceFieldForCategory(category);

    // Collect prices and per-tsubo values for the target area
    const prices: number[] = [];
    const perTsuboPrices: number[] = [];

    for (const prop of allProps) {
      const pd = prop.property_data;
      if (!matchesArea(pd, area)) continue;
      if (!matchesMadori(pd, madori)) continue;
      if (!matchesAge(pd, ageMax)) continue;

      const rawPrice = pd[priceField] || pd["価格"] || pd["販売価格"] || "";
      const price = parsePrice(rawPrice);
      if (price === null || price <= 0) continue;

      prices.push(price);

      const areaM2 = extractAreaM2(pd);
      if (areaM2 && areaM2 > 0) {
        const tsubo = convertM2ToTsubo(areaM2);
        if (tsubo > 0) {
          perTsuboPrices.push(Math.round(price / tsubo));
        }
      }
    }

    // ---- Stats ---------------------------------------------------------------

    const stats = calcMarketStats(prices);
    const perTsuboStats = calcMarketStats(perTsuboPrices);

    // ---- Histogram -----------------------------------------------------------

    const histogram = buildHistogram(prices, 10);

    // ---- Comparison with adjacent cities -------------------------------------

    const adjacentCities = getAdjacentCities(area);

    // Limit to top 5 adjacent cities to keep response size manageable
    const comparisonCities = adjacentCities.slice(0, 5);

    const comparison: Array<{
      area: string;
      count: number;
      avg: number;
      median: number;
    }> = [];

    for (const adjCity of comparisonCities) {
      const adjPrices: number[] = [];

      for (const prop of allProps) {
        const pd = prop.property_data;
        if (!matchesArea(pd, adjCity)) continue;
        // Apply same madori and age filters for fair comparison
        if (!matchesMadori(pd, madori)) continue;
        if (!matchesAge(pd, ageMax)) continue;

        const rawPrice = pd[priceField] || pd["価格"] || pd["販売価格"] || "";
        const price = parsePrice(rawPrice);
        if (price === null || price <= 0) continue;

        adjPrices.push(price);
      }

      if (adjPrices.length === 0) continue;

      const adjStats = calcMarketStats(adjPrices);
      if (adjStats) {
        comparison.push({
          area: adjCity,
          count: adjStats.count,
          avg: adjStats.avg,
          median: adjStats.median,
        });
      }
    }

    // Sort comparison by count descending
    comparison.sort((a, b) => b.count - a.count);

    // ---- Build response ------------------------------------------------------

    const responseBody = {
      area,
      category,
      filters: {
        madori: madori || undefined,
        age_max: ageMax ?? undefined,
      },
      stats: stats || {
        avg: 0,
        median: 0,
        min: 0,
        max: 0,
        count: 0,
        percentile25: 0,
        percentile75: 0,
      },
      perTsubo: perTsuboStats || {
        avg: 0,
        median: 0,
        min: 0,
        max: 0,
        count: 0,
        percentile25: 0,
        percentile75: 0,
      },
      histogram,
      comparison,
    };

    setCache(cacheKey, responseBody);

    return NextResponse.json(responseBody);
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Internal server error";
    console.error("Market price API error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
