"use client";

import { useState, useCallback } from "react";
import dynamic from "next/dynamic";
import { Loader2, MapPin, BarChart3, DollarSign, Hash } from "lucide-react";
import AreaStatsPanel from "@/components/sales/AreaStatsPanel";
import type { CityStats } from "@/components/sales/ChoroplethMap";
import { useApi } from "@/lib/use-api";
import { ErrorBanner } from "@/components/ui/error-banner";

// ---------------------------------------------------------------------------
// Dynamic import — Leaflet cannot run on the server
// ---------------------------------------------------------------------------

const ChoroplethMap = dynamic(
  () => import("@/components/sales/ChoroplethMap"),
  {
    ssr: false,
    loading: () => (
      <div className="h-full flex items-center justify-center bg-slate-900 rounded-xl border border-slate-700">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-400" />
      </div>
    ),
  },
);

// ---------------------------------------------------------------------------
// Filter tabs
// ---------------------------------------------------------------------------

type TypeFilter = "all" | "rent" | "sale";
type ColorMode = "avgPrice" | "count" | "avgPricePerTsubo";

const TYPE_TABS: { id: TypeFilter; label: string }[] = [
  { id: "all", label: "全て" },
  { id: "rent", label: "賃貸" },
  { id: "sale", label: "売買" },
];

const COLOR_MODES: { id: ColorMode; label: string; icon: typeof DollarSign }[] =
  [
    { id: "avgPrice", label: "価格", icon: DollarSign },
    { id: "count", label: "件数", icon: Hash },
    { id: "avgPricePerTsubo", label: "坪単価", icon: BarChart3 },
  ];

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

interface AreaStatsResponse {
  success: boolean;
  cities: CityStats[];
  totalProperties: number;
}

export default function AreaAnalysisPage() {
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [colorMode, setColorMode] = useState<ColorMode>("avgPrice");
  const [selectedCity, setSelectedCity] = useState<CityStats | null>(null);

  const { data, error, loading, refetch } = useApi<AreaStatsResponse>(
    typeFilter === "all"
      ? "/api/sales/area-stats"
      : `/api/sales/area-stats?type=${typeFilter}`,
  );
  const cities = data?.cities ?? [];

  const handleCityClick = useCallback((city: CityStats) => {
    setSelectedCity(city);
  }, []);

  const handleClosePanel = useCallback(() => {
    setSelectedCity(null);
  }, []);

  return (
    <div className="min-h-screen bg-slate-950">
      {error && (
        <div className="px-4 sm:px-6 pt-4">
          <ErrorBanner message={error} onRetry={refetch} />
        </div>
      )}
      {/* Header */}
      <div className="bg-slate-900/80 backdrop-blur-md border-b border-slate-800">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            {/* Title */}
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-500/20 rounded-lg">
                <MapPin className="h-5 w-5 text-emerald-400" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">エリア分析</h1>
                <p className="text-xs text-slate-400 mt-0.5">
                  沖縄本島の不動産マーケット俯瞰マップ
                </p>
              </div>
            </div>

            {/* Controls */}
            <div className="flex flex-wrap items-center gap-3">
              {/* Type filter tabs */}
              <div className="flex bg-slate-800 rounded-lg p-0.5 border border-slate-700/50">
                {TYPE_TABS.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => {
                      setTypeFilter(tab.id);
                      setSelectedCity(null);
                    }}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                      typeFilter === tab.id
                        ? "bg-emerald-600 text-white"
                        : "text-slate-400 hover:text-white"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Color mode toggle */}
              <div className="flex bg-slate-800 rounded-lg p-0.5 border border-slate-700/50">
                {COLOR_MODES.map((mode) => {
                  const Icon = mode.icon;
                  return (
                    <button
                      key={mode.id}
                      onClick={() => setColorMode(mode.id)}
                      className={`flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                        colorMode === mode.id
                          ? "bg-slate-600 text-white"
                          : "text-slate-400 hover:text-white"
                      }`}
                    >
                      <Icon className="h-3 w-3" />
                      {mode.label}
                    </button>
                  );
                })}
              </div>

              {/* Total count */}
              {!loading && (
                <span className="text-xs text-slate-500">
                  {cities.length} エリア
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-4">
        <div className="flex flex-col lg:flex-row gap-4 h-[calc(100vh-130px)]">
          {/* Map area — ~70% on desktop */}
          <div className="flex-1 min-h-[400px] lg:min-h-0">
            {loading ? (
              <div className="h-full flex items-center justify-center bg-slate-900 rounded-xl border border-slate-700">
                <div className="text-center">
                  <Loader2 className="h-8 w-8 animate-spin text-emerald-400 mx-auto mb-3" />
                  <p className="text-sm text-slate-400">
                    エリアデータを取得中...
                  </p>
                </div>
              </div>
            ) : (
              <ChoroplethMap
                cities={cities}
                onCityClick={handleCityClick}
                colorBy={colorMode}
              />
            )}
          </div>

          {/* Side panel — ~30% on desktop, bottom sheet on mobile */}
          <div className="w-full lg:w-80 xl:w-96 flex-shrink-0">
            <AreaStatsPanel city={selectedCity} onClose={handleClosePanel} />
          </div>
        </div>
      </div>

      {/* Mobile overlay panel */}
      {selectedCity && (
        <div className="fixed inset-0 z-50 lg:hidden">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={handleClosePanel}
          />
          {/* Panel */}
          <div className="absolute bottom-0 left-0 right-0 max-h-[70vh] animate-slide-up">
            <AreaStatsPanel city={selectedCity} onClose={handleClosePanel} />
          </div>
        </div>
      )}

      {/* Inline style for mobile slide-up animation */}
      <style jsx global>{`
        @keyframes slide-up {
          from {
            transform: translateY(100%);
          }
          to {
            transform: translateY(0);
          }
        }
        .animate-slide-up {
          animation: slide-up 0.3s ease-out;
        }
        /* Override Leaflet tooltip for dark theme */
        .choropleth-tooltip {
          background: rgba(15, 23, 42, 0.95) !important;
          border: 1px solid rgba(255, 255, 255, 0.15) !important;
          border-radius: 8px !important;
          color: #e2e8f0 !important;
          padding: 8px 12px !important;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4) !important;
        }
        .choropleth-tooltip::before {
          border-top-color: rgba(15, 23, 42, 0.95) !important;
        }
        /* Hide default city label icon background */
        .city-label {
          background: transparent !important;
          border: none !important;
        }
      `}</style>
    </div>
  );
}
