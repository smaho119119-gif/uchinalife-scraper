"use client";

import { useState, useCallback } from "react";
import { useMarketPriceSearch } from "@/lib/use-market-price";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Home,
  Store,
  Car,
  ParkingCircle,
  MapPin,
  Building,
  Package,
  BarChart3,
  Calculator,
  TrendingUp,
  ArrowRight,
  Loader2,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { REGIONS } from "@/lib/area";
import { formatPrice } from "@/lib/price";
import PriceDistributionChart from "./PriceDistributionChart";
import AreaComparisonTable from "./AreaComparisonTable";

// --------------------------------------------------------------------------
// Category definitions (mirrors properties page)
// --------------------------------------------------------------------------

const CATEGORIES = {
  rent: [
    {
      id: "jukyo",
      label: "住居",
      icon: Home,
      color: "from-blue-500 to-blue-600",
    },
    {
      id: "jigyou",
      label: "事業用",
      icon: Store,
      color: "from-purple-500 to-purple-600",
    },
    {
      id: "yard",
      label: "月極駐車場",
      icon: Car,
      color: "from-green-500 to-green-600",
    },
    {
      id: "parking",
      label: "時間貸駐車場",
      icon: ParkingCircle,
      color: "from-teal-500 to-teal-600",
    },
  ],
  buy: [
    {
      id: "tochi",
      label: "土地",
      icon: MapPin,
      color: "from-orange-500 to-orange-600",
    },
    {
      id: "mansion",
      label: "マンション",
      icon: Building,
      color: "from-rose-500 to-rose-600",
    },
    {
      id: "house",
      label: "戸建",
      icon: Home,
      color: "from-amber-500 to-amber-600",
    },
    {
      id: "sonota",
      label: "その他",
      icon: Package,
      color: "from-slate-500 to-slate-600",
    },
  ],
};

const RENTAL_IDS = new Set(CATEGORIES.rent.map((c) => c.id));
const RESIDENTIAL_IDS = new Set(["jukyo", "mansion", "house"]);
const BUILDING_IDS = new Set(["jukyo", "jigyou", "mansion", "house"]);

const MADORI_OPTIONS = [
  "1R",
  "1K",
  "1DK",
  "1LDK",
  "2K",
  "2DK",
  "2LDK",
  "3K",
  "3DK",
  "3LDK",
  "4K",
  "4DK",
  "4LDK",
  "5LDK以上",
];

// --------------------------------------------------------------------------
// API response types
// --------------------------------------------------------------------------

// MarketPriceResult moved to lib/use-market-price.ts

// --------------------------------------------------------------------------
// Component
// --------------------------------------------------------------------------

export default function MarketPriceCalculator() {
  // Step state
  const [selectedArea, setSelectedArea] = useState<string>("");
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [madori, setMadori] = useState<string>("");
  const [ageMax, setAgeMax] = useState<number>(30);

  // UI state
  const [showConditions, setShowConditions] = useState(false);
  const { result, loading, error, search } = useMarketPriceSearch();

  const isRental = RENTAL_IDS.has(selectedCategory);
  const showMadori = RESIDENTIAL_IDS.has(selectedCategory);
  const showAge = BUILDING_IDS.has(selectedCategory);

  const categoryLabel =
    [...CATEGORIES.rent, ...CATEGORIES.buy].find(
      (c) => c.id === selectedCategory
    )?.label ?? "";

  const canSearch = selectedArea !== "" && selectedCategory !== "";

  // ---- Search handler ----

  const handleSearch = useCallback(() => {
    if (!canSearch) return;
    search({
      area: selectedArea,
      category: selectedCategory,
      madori: showMadori ? madori : undefined,
      ageMax: showAge && ageMax < 30 ? ageMax : undefined,
    });
  }, [canSearch, selectedArea, selectedCategory, madori, ageMax, showMadori, showAge, search]);

  // ---- Price display helper ----

  const displayPrice = (value: number) => {
    if (isRental) {
      if (value >= 10000) {
        return `${(value / 10000).toFixed(1)}万円`;
      }
      return `${value.toLocaleString()}円`;
    }
    return formatPrice(value);
  };

  // --------------------------------------------------------------------------
  // Render
  // --------------------------------------------------------------------------

  return (
    <div className="space-y-6">
      {/* ============================================================ */}
      {/* Step 1: エリア選択 */}
      {/* ============================================================ */}
      <Card className="bg-slate-900/80 border-slate-800 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2 text-base">
            <span className="flex items-center justify-center w-7 h-7 rounded-full bg-emerald-600 text-white text-xs font-bold">
              1
            </span>
            エリアを選択
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Select value={selectedArea} onValueChange={setSelectedArea}>
            <SelectTrigger className="w-full bg-slate-800 border-slate-700 text-white min-h-[44px]">
              <SelectValue placeholder="エリアを選んでください" />
            </SelectTrigger>
            <SelectContent className="bg-slate-800 border-slate-700">
              {REGIONS.map((region) => (
                <SelectGroup key={region.name}>
                  <SelectLabel className="text-emerald-400 font-semibold">
                    {region.name}
                  </SelectLabel>
                  {region.cities.map((city) => (
                    <SelectItem
                      key={city}
                      value={city}
                      className="text-slate-200 focus:bg-emerald-900/50 focus:text-white min-h-[44px]"
                    >
                      {city}
                    </SelectItem>
                  ))}
                </SelectGroup>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* ============================================================ */}
      {/* Step 2: カテゴリ選択 */}
      {/* ============================================================ */}
      <Card className="bg-slate-900/80 border-slate-800 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2 text-base">
            <span className="flex items-center justify-center w-7 h-7 rounded-full bg-emerald-600 text-white text-xs font-bold">
              2
            </span>
            カテゴリを選択
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* 賃貸 */}
          <div>
            <p className="text-xs font-semibold text-blue-400 mb-2">
              賃貸カテゴリ
            </p>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.rent.map((cat) => {
                const Icon = cat.icon;
                const isSelected = selectedCategory === cat.id;
                return (
                  <Button
                    key={cat.id}
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedCategory(cat.id)}
                    className={
                      isSelected
                        ? `bg-gradient-to-r ${cat.color} text-white border-transparent shadow-lg transition-all duration-200 scale-105 min-h-[44px]`
                        : "bg-slate-800/50 border-slate-700 text-slate-300 hover:bg-slate-700 transition-all duration-200 min-h-[44px]"
                    }
                  >
                    <Icon className="h-4 w-4 mr-1" />
                    {cat.label}
                  </Button>
                );
              })}
            </div>
          </div>

          {/* 売買 */}
          <div>
            <p className="text-xs font-semibold text-orange-400 mb-2">
              売買カテゴリ
            </p>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.buy.map((cat) => {
                const Icon = cat.icon;
                const isSelected = selectedCategory === cat.id;
                return (
                  <Button
                    key={cat.id}
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedCategory(cat.id)}
                    className={
                      isSelected
                        ? `bg-gradient-to-r ${cat.color} text-white border-transparent shadow-lg transition-all duration-200 scale-105 min-h-[44px]`
                        : "bg-slate-800/50 border-slate-700 text-slate-300 hover:bg-slate-700 transition-all duration-200 min-h-[44px]"
                    }
                  >
                    <Icon className="h-4 w-4 mr-1" />
                    {cat.label}
                  </Button>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ============================================================ */}
      {/* Step 3: 条件 (optional, collapsible) */}
      {/* ============================================================ */}
      {(showMadori || showAge) && (
        <Card className="bg-slate-900/80 border-slate-800 backdrop-blur-sm">
          <CardHeader>
            <button
              type="button"
              className="flex items-center gap-2 w-full text-left"
              onClick={() => setShowConditions((v) => !v)}
            >
              <CardTitle className="text-white flex items-center gap-2 text-base flex-1">
                <span className="flex items-center justify-center w-7 h-7 rounded-full bg-slate-600 text-white text-xs font-bold">
                  3
                </span>
                条件を絞り込む（任意）
              </CardTitle>
              {showConditions ? (
                <ChevronUp className="h-5 w-5 text-slate-400" />
              ) : (
                <ChevronDown className="h-5 w-5 text-slate-400" />
              )}
            </button>
          </CardHeader>

          {showConditions && (
            <CardContent className="space-y-5">
              {/* 間取り */}
              {showMadori && (
                <div>
                  <label className="text-xs text-slate-400 block mb-2">
                    間取り
                  </label>
                  <Select value={madori} onValueChange={setMadori}>
                    <SelectTrigger className="w-full bg-slate-800 border-slate-700 text-white min-h-[44px]">
                      <SelectValue placeholder="指定なし" />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-800 border-slate-700">
                      <SelectItem
                        value="all"
                        className="text-slate-200 focus:bg-emerald-900/50 focus:text-white min-h-[44px]"
                      >
                        指定なし
                      </SelectItem>
                      {MADORI_OPTIONS.map((m) => (
                        <SelectItem
                          key={m}
                          value={m}
                          className="text-slate-200 focus:bg-emerald-900/50 focus:text-white min-h-[44px]"
                        >
                          {m}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* 築年数 */}
              {showAge && (
                <div>
                  <label className="text-xs text-slate-400 block mb-2">
                    築年数: {ageMax === 30 ? "指定なし" : `${ageMax}年以内`}
                  </label>
                  <input
                    type="range"
                    min={0}
                    max={30}
                    step={1}
                    value={ageMax}
                    onChange={(e) => setAgeMax(Number(e.target.value))}
                    className="w-full h-2 rounded-lg appearance-none cursor-pointer bg-slate-700 accent-emerald-500"
                    style={{ minHeight: 44 }}
                  />
                  <div className="flex justify-between text-xs text-slate-500 mt-1">
                    <span>新築</span>
                    <span>10年</span>
                    <span>20年</span>
                    <span>30年+</span>
                  </div>
                </div>
              )}
            </CardContent>
          )}
        </Card>
      )}

      {/* ============================================================ */}
      {/* Search button */}
      {/* ============================================================ */}
      <Button
        onClick={handleSearch}
        disabled={!canSearch || loading}
        className={
          canSearch
            ? "w-full bg-gradient-to-r from-emerald-500 to-emerald-600 text-white border-emerald-700 shadow-lg shadow-emerald-500/30 min-h-[52px] text-base"
            : "w-full bg-slate-700 text-slate-400 border-slate-600 min-h-[52px] text-base cursor-not-allowed"
        }
      >
        {loading ? (
          <>
            <Loader2 className="h-5 w-5 mr-2 animate-spin" />
            検索中...
          </>
        ) : (
          <>
            <Calculator className="h-5 w-5 mr-2" />
            相場を調べる
            <ArrowRight className="h-5 w-5 ml-2" />
          </>
        )}
      </Button>

      {/* ============================================================ */}
      {/* Error */}
      {/* ============================================================ */}
      {error && (
        <Card className="bg-red-900/30 border-red-800">
          <CardContent className="p-4">
            <p className="text-red-300 text-sm">{error}</p>
          </CardContent>
        </Card>
      )}

      {/* ============================================================ */}
      {/* Results */}
      {/* ============================================================ */}
      {result && (
        <div className="space-y-6">
          {/* Title badge */}
          <div className="flex items-center gap-2 flex-wrap">
            <Badge className="bg-emerald-900/50 text-emerald-300 border-emerald-700">
              {selectedArea}
            </Badge>
            <Badge className="bg-slate-800 text-slate-300 border-slate-700">
              {categoryLabel}
            </Badge>
            {madori && madori !== "all" && (
              <Badge className="bg-slate-800 text-slate-300 border-slate-700">
                {madori}
              </Badge>
            )}
            {ageMax < 30 && showAge && (
              <Badge className="bg-slate-800 text-slate-300 border-slate-700">
                築{ageMax}年以内
              </Badge>
            )}
          </div>

          {/* Stat cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {/* 平均 */}
            <Card className="bg-gradient-to-br from-emerald-900/60 to-emerald-800/40 border-emerald-700/50">
              <CardContent className="p-4 text-center">
                <p className="text-xs text-emerald-300 mb-1">平均</p>
                <p className="text-xl font-bold text-white">
                  {displayPrice(result.stats.avg)}
                </p>
              </CardContent>
            </Card>

            {/* 中央値 */}
            <Card className="bg-gradient-to-br from-blue-900/60 to-blue-800/40 border-blue-700/50">
              <CardContent className="p-4 text-center">
                <p className="text-xs text-blue-300 mb-1">中央値</p>
                <p className="text-xl font-bold text-white">
                  {displayPrice(result.stats.median)}
                </p>
              </CardContent>
            </Card>

            {/* 最安 */}
            <Card className="bg-gradient-to-br from-cyan-900/60 to-cyan-800/40 border-cyan-700/50">
              <CardContent className="p-4 text-center">
                <p className="text-xs text-cyan-300 mb-1">最安</p>
                <p className="text-xl font-bold text-white">
                  {displayPrice(result.stats.min)}
                </p>
              </CardContent>
            </Card>

            {/* 最高 */}
            <Card className="bg-gradient-to-br from-amber-900/60 to-amber-800/40 border-amber-700/50">
              <CardContent className="p-4 text-center">
                <p className="text-xs text-amber-300 mb-1">最高</p>
                <p className="text-xl font-bold text-white">
                  {displayPrice(result.stats.max)}
                </p>
              </CardContent>
            </Card>

            {/* 件数 */}
            <Card className="bg-gradient-to-br from-purple-900/60 to-purple-800/40 border-purple-700/50">
              <CardContent className="p-4 text-center">
                <p className="text-xs text-purple-300 mb-1">件数</p>
                <p className="text-xl font-bold text-white">
                  {result.stats.count.toLocaleString()}
                  <span className="text-sm font-normal text-slate-400 ml-1">
                    件
                  </span>
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Tsubo stats (if available) */}
          {result.tsuboStats && (
            <div className="grid grid-cols-2 gap-4">
              <Card className="bg-slate-900/80 border-slate-800">
                <CardContent className="p-4 text-center">
                  <p className="text-xs text-slate-400 mb-1">
                    <TrendingUp className="h-3 w-3 inline mr-1" />
                    坪単価（平均）
                  </p>
                  <p className="text-lg font-bold text-emerald-400">
                    {formatPrice(result.tsuboStats.avgPerTsubo)}
                    <span className="text-sm font-normal text-slate-400">
                      /坪
                    </span>
                  </p>
                </CardContent>
              </Card>
              <Card className="bg-slate-900/80 border-slate-800">
                <CardContent className="p-4 text-center">
                  <p className="text-xs text-slate-400 mb-1">
                    <TrendingUp className="h-3 w-3 inline mr-1" />
                    坪単価（中央値）
                  </p>
                  <p className="text-lg font-bold text-blue-400">
                    {formatPrice(result.tsuboStats.medianPerTsubo)}
                    <span className="text-sm font-normal text-slate-400">
                      /坪
                    </span>
                  </p>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Price distribution chart */}
          <Card className="bg-slate-900/80 border-slate-800 backdrop-blur-sm">
            <CardContent className="p-4 md:p-6">
              <PriceDistributionChart
                histogram={result.histogram}
                category={isRental ? "賃貸" : "売買"}
              />
            </CardContent>
          </Card>

          {/* Area comparison table */}
          {result.areaComparison && result.areaComparison.length > 0 && (
            <Card className="bg-slate-900/80 border-slate-800 backdrop-blur-sm">
              <CardContent className="p-4 md:p-6">
                <AreaComparisonTable
                  data={result.areaComparison}
                  currentArea={selectedArea}
                  isRental={isRental}
                />
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
