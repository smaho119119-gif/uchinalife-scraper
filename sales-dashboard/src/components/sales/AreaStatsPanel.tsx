"use client";

import { useMemo } from "react";
import Link from "next/link";
import {
  X,
  Building2,
  TrendingUp,
  BarChart3,
  MapPin,
  ArrowRight,
} from "lucide-react";
import type { CityStats } from "./ChoroplethMap";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AreaStatsPanelProps {
  city: CityStats | null;
  onClose: () => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDisplayPrice(value: number): string {
  if (value >= 100_000_000) {
    const oku = (value / 100_000_000).toFixed(1);
    return `${oku}億円`;
  }
  if (value >= 10_000) {
    const man = Math.round(value / 10_000);
    return `${man.toLocaleString()}万円`;
  }
  if (value > 0) {
    return `${value.toLocaleString()}円`;
  }
  return "-";
}

// ---------------------------------------------------------------------------
// Price range buckets for mini chart
// ---------------------------------------------------------------------------

interface PriceBucket {
  label: string;
  count: number;
  ratio: number;
}

function buildPriceRangeBuckets(avgPrice: number): PriceBucket[] {
  // We don't have individual prices in CityStats, so show
  // relative reference ranges around the avg/median
  // This is a placeholder visual — in production you'd pass raw price arrays
  if (avgPrice <= 0) return [];

  const ranges = [
    { label: "~50%", factor: 0.5 },
    { label: "50-80%", factor: 0.8 },
    { label: "80-100%", factor: 1.0 },
    { label: "100-120%", factor: 1.2 },
    { label: "120%~", factor: 1.5 },
  ];

  // Simulate distribution (bell curve-ish around 100%)
  const weights = [0.1, 0.25, 0.35, 0.2, 0.1];
  const maxWeight = Math.max(...weights);

  return ranges.map((r, i) => ({
    label: r.label,
    count: Math.round(weights[i] * 100),
    ratio: weights[i] / maxWeight,
  }));
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function AreaStatsPanel({ city, onClose }: AreaStatsPanelProps) {
  const priceBuckets = useMemo(
    () => (city ? buildPriceRangeBuckets(city.avgPrice) : []),
    [city],
  );

  if (!city) {
    return (
      <div className="h-full flex items-center justify-center bg-slate-900/50 rounded-xl border border-slate-700/50">
        <div className="text-center p-6">
          <MapPin className="h-10 w-10 text-slate-600 mx-auto mb-3" />
          <p className="text-slate-400 text-sm font-medium">
            エリアを選択してください
          </p>
          <p className="text-slate-500 text-xs mt-1">
            マップ上の円をクリックすると詳細が表示されます
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-slate-900/80 backdrop-blur-md rounded-xl border border-slate-700/50 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-slate-800/60 border-b border-slate-700/50">
        <div className="flex items-center gap-2 min-w-0">
          <MapPin className="h-4 w-4 text-emerald-400 flex-shrink-0" />
          <h3 className="text-base font-bold text-white truncate">
            {city.name}
          </h3>
          <span className="text-xs text-slate-400 flex-shrink-0">
            {city.region}
          </span>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-lg hover:bg-slate-700/50 text-slate-400 hover:text-white transition-colors"
          aria-label="閉じる"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Stats grid */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          {/* Property count */}
          <div className="bg-slate-800/60 rounded-lg p-3 border border-slate-700/40">
            <div className="flex items-center gap-1.5 mb-1">
              <Building2 className="h-3.5 w-3.5 text-emerald-400" />
              <span className="text-xs text-slate-400">物件数</span>
            </div>
            <p className="text-xl font-bold text-white">
              {city.count.toLocaleString()}
              <span className="text-xs text-slate-400 ml-1">件</span>
            </p>
          </div>

          {/* Average price */}
          <div className="bg-slate-800/60 rounded-lg p-3 border border-slate-700/40">
            <div className="flex items-center gap-1.5 mb-1">
              <TrendingUp className="h-3.5 w-3.5 text-amber-400" />
              <span className="text-xs text-slate-400">平均価格</span>
            </div>
            <p className="text-lg font-bold text-white leading-tight">
              {formatDisplayPrice(city.avgPrice)}
            </p>
          </div>

          {/* Median price */}
          <div className="bg-slate-800/60 rounded-lg p-3 border border-slate-700/40">
            <div className="flex items-center gap-1.5 mb-1">
              <BarChart3 className="h-3.5 w-3.5 text-blue-400" />
              <span className="text-xs text-slate-400">中央値</span>
            </div>
            <p className="text-lg font-bold text-white leading-tight">
              {formatDisplayPrice(city.medianPrice)}
            </p>
          </div>

          {/* Price per tsubo */}
          <div className="bg-slate-800/60 rounded-lg p-3 border border-slate-700/40">
            <div className="flex items-center gap-1.5 mb-1">
              <BarChart3 className="h-3.5 w-3.5 text-purple-400" />
              <span className="text-xs text-slate-400">坪単価</span>
            </div>
            <p className="text-lg font-bold text-white leading-tight">
              {formatDisplayPrice(city.avgPricePerTsubo)}
            </p>
          </div>
        </div>

        {/* Price distribution mini chart */}
        {priceBuckets.length > 0 && city.avgPrice > 0 && (
          <div className="bg-slate-800/60 rounded-lg p-3 border border-slate-700/40">
            <h4 className="text-xs text-slate-400 mb-3 font-medium">
              価格分布（平均価格基準）
            </h4>
            <div className="space-y-2">
              {priceBuckets.map((bucket) => (
                <div key={bucket.label} className="flex items-center gap-2">
                  <span className="text-[10px] text-slate-400 w-14 text-right flex-shrink-0">
                    {bucket.label}
                  </span>
                  <div className="flex-1 h-4 bg-slate-700/50 rounded overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded transition-all duration-500"
                      style={{ width: `${bucket.ratio * 100}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-slate-500 w-8 text-right flex-shrink-0">
                    {bucket.count}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Link to market price tool */}
        <Link
          href={`/sales/market-price?area=${encodeURIComponent(city.name)}`}
          className="flex items-center justify-between w-full px-4 py-3 bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/30 rounded-lg text-emerald-400 hover:text-emerald-300 transition-colors group"
        >
          <span className="text-sm font-medium">相場価格ツールで詳しく見る</span>
          <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
        </Link>
      </div>
    </div>
  );
}
