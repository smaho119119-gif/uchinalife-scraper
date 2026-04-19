/**
 * Unified price parsing and formatting for Japanese real estate.
 * Handles 万円, 億円, full-width numerals, rent prices, ranges, etc.
 */

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Convert full-width digits to half-width */
function normalizeDigits(str: string): string {
  return str
    .replace(/[０-９]/g, (s) => String.fromCharCode(s.charCodeAt(0) - 0xfee0))
    .replace(/[,，]/g, "");
}

/** Check if the string indicates "contact us" / "negotiable" instead of a price */
function isInquiryOnly(str: string): boolean {
  return /問|相談|応相談|未定|非公開/.test(str);
}

// ---------------------------------------------------------------------------
// parsePrice
// ---------------------------------------------------------------------------

/**
 * Parse a Japanese price string into yen (number) or null.
 *
 * Supported formats:
 *  - "4,980万円"      → 49800000
 *  - "1億2,000万円"   → 120000000
 *  - "5.8万円"        → 58000   (rent)
 *  - "54,000円"       → 54000
 *  - "お問い合わせ"   → null
 *  - "3,980万円～4,500万円" → 39800000 (first value)
 *  - Full-width numerals are auto-converted
 */
export function parsePrice(priceStr: string | null | undefined): number | null {
  if (!priceStr) return null;

  if (isInquiryOnly(priceStr)) return null;

  // For ranges, take the first value (before ～ / ~ / 〜 / -)
  const rangeSegment = priceStr.split(/[～〜~\-－]/)[0];

  const numStr = normalizeDigits(rangeSegment);

  // 億 + optional 万
  const okuMatch = numStr.match(/(\d+(?:\.\d+)?)\s*億/);
  if (okuMatch) {
    let total = parseFloat(okuMatch[1]) * 100_000_000;
    const remainingMan = numStr.match(/億\s*(\d+(?:\.\d+)?)\s*万/);
    if (remainingMan) {
      total += parseFloat(remainingMan[1]) * 10_000;
    }
    return total;
  }

  // 万 (includes rent like "5.8万円")
  const manMatch = numStr.match(/(\d+(?:\.\d+)?)\s*万/);
  if (manMatch) {
    return parseFloat(manMatch[1]) * 10_000;
  }

  // Plain 円 (e.g. "54,000円")
  const yenMatch = numStr.match(/(\d+)\s*円/);
  if (yenMatch) {
    return parseInt(yenMatch[1], 10);
  }

  // Bare number — heuristic: >= 100,000 treated as yen, else as 万円
  const numOnly = numStr.match(/(\d+(?:\.\d+)?)/);
  if (numOnly) {
    const num = parseFloat(numOnly[1]);
    if (num >= 100_000) return num;
    return num * 10_000;
  }

  return null;
}

// ---------------------------------------------------------------------------
// formatPrice / formatPriceShort
// ---------------------------------------------------------------------------

/**
 * Format yen value as "4,980万円" / "1.2億円" style.
 */
export function formatPrice(value: number): string {
  if (value >= 100_000_000) {
    const oku = Math.floor(value / 100_000_000);
    const manRemainder = Math.round((value % 100_000_000) / 10_000);
    if (manRemainder > 0) {
      return `${oku}億${manRemainder.toLocaleString()}万円`;
    }
    return `${oku}億円`;
  }
  if (value >= 10_000) {
    const man = Math.round(value / 10_000);
    return `${man.toLocaleString()}万円`;
  }
  return `${value.toLocaleString()}円`;
}

/**
 * Same as formatPrice but without the trailing 円.
 * "4,980万" / "1億2,000万"
 */
export function formatPriceShort(value: number): string {
  if (value >= 100_000_000) {
    const oku = Math.floor(value / 100_000_000);
    const manRemainder = Math.round((value % 100_000_000) / 10_000);
    if (manRemainder > 0) {
      return `${oku}億${manRemainder.toLocaleString()}万`;
    }
    return `${oku}億`;
  }
  if (value >= 10_000) {
    const man = Math.round(value / 10_000);
    return `${man.toLocaleString()}万`;
  }
  return `${value.toLocaleString()}`;
}

// ---------------------------------------------------------------------------
// Area conversion
// ---------------------------------------------------------------------------

const TSUBO_PER_M2 = 3.30579;

/**
 * Convert square metres to tsubo (坪).  1坪 = 3.30579 m²
 */
export function convertM2ToTsubo(m2: number): number {
  return m2 / TSUBO_PER_M2;
}

/**
 * Convert tsubo (坪) to square metres.
 */
export function convertTsuboToM2(tsubo: number): number {
  return tsubo * TSUBO_PER_M2;
}

// ---------------------------------------------------------------------------
// parseArea
// ---------------------------------------------------------------------------

/**
 * Parse an area string to square metres.
 *
 *  - "158.26m²"  → 158.26
 *  - "47.87坪"   → 47.87 * 3.30579
 *  - "158.26㎡"  → 158.26
 *  - bare number → treated as m²
 */
export function parseArea(str: string | null | undefined): number | null {
  if (!str) return null;

  const normalized = normalizeDigits(str);

  // Tsubo
  const tsuboMatch = normalized.match(/(\d+(?:\.\d+)?)\s*坪/);
  if (tsuboMatch) {
    return convertTsuboToM2(parseFloat(tsuboMatch[1]));
  }

  // m² / ㎡
  const m2Match = normalized.match(/(\d+(?:\.\d+)?)\s*(?:m[²2]|㎡)/i);
  if (m2Match) {
    return parseFloat(m2Match[1]);
  }

  // Bare number
  const bare = normalized.match(/(\d+(?:\.\d+)?)/);
  if (bare) {
    return parseFloat(bare[1]);
  }

  return null;
}

// ---------------------------------------------------------------------------
// parsePricePerArea
// ---------------------------------------------------------------------------

export interface PricePerArea {
  perM2: number;
  perTsubo: number;
}

/**
 * Calculate price per m² and price per tsubo.
 * Returns null if either input is missing / zero.
 */
export function parsePricePerArea(
  price: number | null | undefined,
  areaM2: number | null | undefined,
): PricePerArea | null {
  if (!price || !areaM2 || areaM2 <= 0) return null;

  const perM2 = Math.round(price / areaM2);
  const perTsubo = Math.round(price / convertM2ToTsubo(areaM2));

  return { perM2, perTsubo };
}

// ---------------------------------------------------------------------------
// calcMarketStats
// ---------------------------------------------------------------------------

export interface MarketStats {
  avg: number;
  median: number;
  min: number;
  max: number;
  count: number;
  percentile25: number;
  percentile75: number;
}

/**
 * Calculate summary statistics for a list of prices.
 * Ignores null / NaN / non-positive values.
 * Returns null if no valid values remain.
 */
export function calcMarketStats(
  prices: (number | null | undefined)[],
): MarketStats | null {
  const valid = prices.filter(
    (p): p is number => typeof p === "number" && Number.isFinite(p) && p > 0,
  );

  if (valid.length === 0) return null;

  const sorted = [...valid].sort((a, b) => a - b);
  const count = sorted.length;
  const sum = sorted.reduce((s, v) => s + v, 0);

  return {
    avg: Math.round(sum / count),
    median: percentile(sorted, 50),
    min: sorted[0],
    max: sorted[count - 1],
    count,
    percentile25: percentile(sorted, 25),
    percentile75: percentile(sorted, 75),
  };
}

/**
 * Nearest-rank percentile on a pre-sorted array.
 */
function percentile(sorted: number[], p: number): number {
  if (sorted.length === 1) return sorted[0];
  const index = (p / 100) * (sorted.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sorted[lower];
  // Linear interpolation
  return Math.round(
    sorted[lower] + (sorted[upper] - sorted[lower]) * (index - lower),
  );
}
