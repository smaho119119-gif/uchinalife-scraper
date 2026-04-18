import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { parsePrice, parseArea, convertM2ToTsubo } from "@/lib/price";
import {
  extractCityName,
  getCityCoordinates,
  getRegionFull,
} from "@/lib/area";

// ---------------------------------------------------------------------------
// Supabase
// ---------------------------------------------------------------------------

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_ANON_KEY!;

// ---------------------------------------------------------------------------
// In-memory cache (5 min TTL)
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
// Rental vs sale category mapping
// ---------------------------------------------------------------------------

const RENTAL_CATEGORIES = new Set(["jukyo", "jigyo", "yard", "parking"]);

function isRental(category: string): boolean {
  return RENTAL_CATEGORIES.has(category);
}

function getPriceField(category: string): string {
  return isRental(category) ? "家賃" : "価格";
}

// ---------------------------------------------------------------------------
// GET /api/sales/area-stats?category=house&type=sale
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category") || "";
    const type = searchParams.get("type") || "all"; // "rent" | "sale" | "all"

    // Cache key
    const cacheKey = `area-stats-${category}-${type}`;
    const cached = getCached(cacheKey);
    if (cached) {
      return NextResponse.json(cached);
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch all active properties with pagination
    const properties: any[] = [];
    let from = 0;
    const pageSize = 1000;
    let hasMore = true;

    while (hasMore) {
      let query = supabase
        .from("properties")
        .select("category, category_type, property_data")
        .eq("is_active", true);

      if (category) {
        query = query.eq("category", category);
      }
      if (type === "rent") {
        query = query.eq("category_type", "賃貸");
      } else if (type === "sale") {
        query = query.eq("category_type", "売買");
      }

      const { data, error } = await query.range(from, from + pageSize - 1);

      if (error) {
        console.error("Error fetching properties:", error);
        break;
      }

      if (!data || data.length === 0) {
        hasMore = false;
        break;
      }

      properties.push(...data);
      hasMore = data.length >= pageSize;
      from += pageSize;
    }

    // Group by city
    const cityMap = new Map<
      string,
      { prices: number[]; pricesPerTsubo: number[]; count: number }
    >();

    for (const prop of properties) {
      const pd = prop.property_data || {};
      const location = pd["所在地"] || pd["住所"] || pd["location"] || "";
      const city = extractCityName(location);

      if (city === "不明") continue;

      if (!cityMap.has(city)) {
        cityMap.set(city, { prices: [], pricesPerTsubo: [], count: 0 });
      }

      const entry = cityMap.get(city)!;
      entry.count++;

      // Parse price
      const priceField = getPriceField(prop.category);
      const rawPrice = pd[priceField] || pd["価格"] || pd["家賃"] || "";
      const price = parsePrice(rawPrice);

      if (price && price > 0) {
        entry.prices.push(price);

        // Calculate price per tsubo (only for sale properties with area)
        const areaStr =
          pd["土地面積"] || pd["専有面積"] || pd["建物面積"] || pd["面積"] || "";
        const areaM2 = parseArea(areaStr);

        if (areaM2 && areaM2 > 0) {
          const tsubo = convertM2ToTsubo(areaM2);
          if (tsubo > 0) {
            entry.pricesPerTsubo.push(Math.round(price / tsubo));
          }
        }
      }
    }

    // Build response
    const cities = Array.from(cityMap.entries())
      .map(([name, data]) => {
        const sorted = [...data.prices].sort((a, b) => a - b);
        const avgPrice =
          sorted.length > 0
            ? Math.round(sorted.reduce((s, v) => s + v, 0) / sorted.length)
            : 0;
        const medianPrice =
          sorted.length > 0 ? sorted[Math.floor(sorted.length / 2)] : 0;

        const tsuboSorted = [...data.pricesPerTsubo].sort((a, b) => a - b);
        const avgPricePerTsubo =
          tsuboSorted.length > 0
            ? Math.round(
                tsuboSorted.reduce((s, v) => s + v, 0) / tsuboSorted.length,
              )
            : 0;

        const coordinates = getCityCoordinates(name);
        const region = getRegionFull(name);

        return {
          name,
          count: data.count,
          avgPrice,
          medianPrice,
          avgPricePerTsubo,
          coordinates: coordinates || [0, 0],
          region: region || "その他",
        };
      })
      // Only include cities with known coordinates
      .filter(
        (c) =>
          c.coordinates[0] !== 0 &&
          c.coordinates[1] !== 0,
      )
      .sort((a, b) => b.count - a.count);

    const result = {
      success: true,
      cities,
      totalProperties: properties.length,
    };

    setCache(cacheKey, result);

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Error in area-stats:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
