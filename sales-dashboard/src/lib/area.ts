/**
 * Area / city extraction utilities for Okinawa real estate.
 * Pure utility functions — no React, no server deps.
 */

// ---------------------------------------------------------------------------
// Region definitions
// ---------------------------------------------------------------------------

export interface Region {
  name: string;
  cities: string[];
}

export const REGIONS: readonly Region[] = [
  {
    name: "那覇・南部",
    cities: [
      "那覇市",
      "浦添市",
      "豊見城市",
      "糸満市",
      "南城市",
      "八重瀬町",
      "南風原町",
      "与那原町",
      "西原町",
    ],
  },
  {
    name: "中部",
    cities: [
      "沖縄市",
      "うるま市",
      "宜野湾市",
      "北谷町",
      "嘉手納町",
      "読谷村",
      "北中城村",
      "中城村",
    ],
  },
  {
    name: "北部",
    cities: [
      "名護市",
      "本部町",
      "今帰仁村",
      "恩納村",
      "金武町",
      "宜野座村",
      "大宜味村",
      "東村",
      "国頭村",
    ],
  },
] as const;

/** Flat array of every city across all regions. */
export const ALL_CITIES: readonly string[] = REGIONS.flatMap((r) => r.cities);

// ---------------------------------------------------------------------------
// City coordinates (approximate centre)  [lat, lng]
// ---------------------------------------------------------------------------

const CITY_COORDINATES: Record<string, [number, number]> = {
  那覇市: [26.2124, 127.6809],
  浦添市: [26.2458, 127.7219],
  豊見城市: [26.1614, 127.6672],
  糸満市: [26.1236, 127.6614],
  南城市: [26.1436, 127.7619],
  八重瀬町: [26.1319, 127.7272],
  南風原町: [26.1919, 127.7272],
  与那原町: [26.2019, 127.7519],
  西原町: [26.2181, 127.7614],
  沖縄市: [26.3344, 127.8056],
  うるま市: [26.3719, 127.8508],
  宜野湾市: [26.2815, 127.7781],
  北谷町: [26.3244, 127.7681],
  嘉手納町: [26.3519, 127.7672],
  読谷村: [26.3969, 127.7472],
  北中城村: [26.3019, 127.7919],
  中城村: [26.2719, 127.7919],
  名護市: [26.5919, 127.9772],
  本部町: [26.6619, 127.8972],
  今帰仁村: [26.6819, 127.9672],
  恩納村: [26.4919, 127.8472],
  金武町: [26.4519, 127.9272],
  宜野座村: [26.4819, 127.9572],
  大宜味村: [26.7219, 128.0472],
  東村: [26.6319, 128.1572],
  国頭村: [26.7519, 128.1772],
};

// ---------------------------------------------------------------------------
// Pre-built lookup maps (built once at module load)
// ---------------------------------------------------------------------------

/** city name → region name */
const cityToRegion = new Map<string, string>();
/** region name → city list */
const regionToCities = new Map<string, string[]>();

for (const region of REGIONS) {
  regionToCities.set(region.name, [...region.cities]);
  for (const city of region.cities) {
    cityToRegion.set(city, region.name);
  }
}

// Adjacency graph — regions that border each other
const ADJACENT_REGIONS: Record<string, string[]> = {
  "那覇・南部": ["中部"],
  中部: ["那覇・南部", "北部"],
  北部: ["中部"],
};

// ---------------------------------------------------------------------------
// Known city names for better extraction (sorted longest-first for greedy match)
// ---------------------------------------------------------------------------

const KNOWN_CITIES_SORTED = [...ALL_CITIES].sort(
  (a, b) => b.length - a.length,
);

// ---------------------------------------------------------------------------
// extractCityName
// ---------------------------------------------------------------------------

/**
 * Extract city / town / village name from a location string.
 *
 * Improvements over the original version:
 *  1. Tries exact match against known Okinawa cities first (handles "うるま市" etc.)
 *  2. Falls back to regex for unknown cities
 *  3. Strips common prefixes ("沖縄県", "〒xxx-xxxx")
 */
export function extractCityName(location: string | null | undefined): string {
  if (!location || location === "不明") return "不明";

  let loc = location
    .replace(/沖縄県/g, "")
    .replace(/〒?\d{3}-?\d{4}\s*/g, "")
    .trim();

  if (!loc) return "不明";

  // 1. Greedy match against known cities (handles "うるま市" which has no kanji before 市)
  for (const city of KNOWN_CITIES_SORTED) {
    if (loc.includes(city)) return city;
  }

  // 2. Regex for 市 / 町 / 村 / 郡 patterns (unknown cities outside our list)
  //    Use a non-greedy match that grabs the municipality suffix
  const gunMatch = loc.match(
    /([^\s]{1,6}郡\s*[^\s]{1,6}(?:町|村))/,
  );
  if (gunMatch) return gunMatch[1].replace(/\s+/g, "");

  const cityMatch = loc.match(
    /([^\s市]{1,6}市|[^\s町]{1,6}町|[^\s村]{1,6}村)/,
  );
  if (cityMatch) return cityMatch[1];

  // 3. First whitespace-separated token
  const parts = loc.split(/[\s　]+/);
  if (parts.length > 0 && parts[0]) return parts[0];

  return "不明";
}

// ---------------------------------------------------------------------------
// extractSubArea
// ---------------------------------------------------------------------------

/**
 * Extract the sub-area (地区) that comes after the city name.
 *
 * "沖縄県那覇市首里当蔵町1-1" → "首里"
 * "北谷町美浜"              → "美浜"
 *
 * Returns null if no sub-area can be determined.
 */
export function extractSubArea(
  location: string | null | undefined,
): string | null {
  if (!location) return null;

  const city = extractCityName(location);
  if (city === "不明") return null;

  // Find position right after the city name
  const cityIdx = location.indexOf(city);
  if (cityIdx < 0) return null;

  const after = location
    .slice(cityIdx + city.length)
    .replace(/^\s+/, "");

  if (!after) return null;

  // Take leading kanji / hiragana / katakana block as sub-area
  // Stop at digits, whitespace, or address separators like 丁目/番/号
  const subMatch = after.match(
    /^([^\d\s０-９、,・\-－]+?)(?:\d|[０-９]|丁目|番|号|$)/,
  );
  if (subMatch && subMatch[1]) {
    return subMatch[1];
  }

  // If the remainder is all text (e.g. "美浜"), use it
  if (/^[^\d\s０-９]+$/.test(after) && after.length <= 10) {
    return after;
  }

  return null;
}

// ---------------------------------------------------------------------------
// getRegion
// ---------------------------------------------------------------------------

/**
 * Map a city name to its region.
 *
 * Returns "南部" | "中部" | "北部" | "離島" | null
 *
 * Note: "那覇・南部" region is returned as "南部" for simpler categorisation.
 */
export function getRegion(
  cityName: string | null | undefined,
): "南部" | "中部" | "北部" | "離島" | null {
  if (!cityName) return null;

  const region = cityToRegion.get(cityName);
  if (!region) return null;

  if (region === "那覇・南部") return "南部";
  if (region === "中部") return "中部";
  if (region === "北部") return "北部";

  return null;
}

/**
 * Get the full region name (as stored in REGIONS).
 * "那覇市" → "那覇・南部"
 */
export function getRegionFull(
  cityName: string | null | undefined,
): string | null {
  if (!cityName) return null;
  return cityToRegion.get(cityName) ?? null;
}

// ---------------------------------------------------------------------------
// getAdjacentCities
// ---------------------------------------------------------------------------

/**
 * Get cities in the same region plus adjacent regions.
 * Excludes the input city itself from the result.
 */
export function getAdjacentCities(
  cityName: string | null | undefined,
): string[] {
  if (!cityName) return [];

  const regionName = cityToRegion.get(cityName);
  if (!regionName) return [];

  const result = new Set<string>();

  // Same region
  const sameRegion = regionToCities.get(regionName);
  if (sameRegion) {
    for (const c of sameRegion) result.add(c);
  }

  // Adjacent regions
  const adjacent = ADJACENT_REGIONS[regionName];
  if (adjacent) {
    for (const adjRegion of adjacent) {
      const cities = regionToCities.get(adjRegion);
      if (cities) {
        for (const c of cities) result.add(c);
      }
    }
  }

  // Remove self
  result.delete(cityName);

  return Array.from(result);
}

// ---------------------------------------------------------------------------
// getCityCoordinates
// ---------------------------------------------------------------------------

/**
 * Approximate centre coordinates for a city.
 * Returns [lat, lng] or null if the city is unknown.
 */
export function getCityCoordinates(
  cityName: string | null | undefined,
): [number, number] | null {
  if (!cityName) return null;
  return CITY_COORDINATES[cityName] ?? null;
}
