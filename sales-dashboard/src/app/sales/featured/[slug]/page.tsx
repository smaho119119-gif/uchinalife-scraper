"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, MapPin, PawPrint, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import FeaturedGrid from "@/components/sales/FeaturedGrid";
import type { FeaturedProperty } from "@/components/sales/FeaturedGrid";
import { formatPrice } from "@/lib/price";

// Category filter options
const CATEGORY_TABS = [
  { id: "", label: "全て" },
  { id: "jukyo", label: "賃貸住居" },
  { id: "jigyo", label: "賃貸事業用" },
  { id: "tochi", label: "売買土地" },
  { id: "mansion", label: "売買マンション" },
  { id: "house", label: "売買戸建" },
];

// Period options for new-listings
const PERIOD_OPTIONS = [
  { days: 7, label: "7日" },
  { days: 14, label: "14日" },
  { days: 30, label: "30日" },
];

// Slug metadata
const SLUG_META: Record<
  string,
  { title: string; badge: string; Icon: typeof PawPrint }
> = {
  "pet-friendly": { title: "ペット可物件", badge: "ペット可", Icon: PawPrint },
  "new-listings": { title: "新着物件", badge: "新着", Icon: Sparkles },
  "by-area": { title: "エリア別物件", badge: "", Icon: MapPin },
};

interface AreaItem {
  area: string;
  count: number;
  categories: Record<string, number>;
  avgPrice: number;
}

export default function FeaturedSlugPage() {
  const params = useParams();
  const slug = params.slug as string;

  const meta = SLUG_META[slug];

  const [properties, setProperties] = useState<FeaturedProperty[]>([]);
  const [areas, setAreas] = useState<AreaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState("");
  const [days, setDays] = useState(7);

  const fetchData = useCallback(async () => {
    setLoading(true);

    try {
      if (slug === "pet-friendly") {
        const params = new URLSearchParams();
        if (category) params.set("category", category);
        const res = await fetch(`/api/sales/featured/pet-friendly?${params}`);
        const data = await res.json();
        setProperties(data.properties || []);
      } else if (slug === "new-listings") {
        const params = new URLSearchParams();
        params.set("days", String(days));
        if (category) params.set("category", category);
        const res = await fetch(`/api/sales/featured/new-listings?${params}`);
        const data = await res.json();
        setProperties(data.properties || []);
      } else if (slug === "by-area") {
        const params = new URLSearchParams();
        if (category) params.set("category", category);
        const res = await fetch(`/api/sales/featured/by-area?${params}`);
        const data = await res.json();
        setAreas(data.areas || []);
      }
    } catch (err) {
      console.error("Error fetching featured data:", err);
    } finally {
      setLoading(false);
    }
  }, [slug, category, days]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (!meta) {
    return (
      <div className="flex-1 p-8 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 min-h-screen text-slate-100">
        <p className="text-slate-400">不明なコレクションです。</p>
        <Link
          href="/sales/featured"
          className="text-emerald-400 hover:underline mt-4 inline-block"
        >
          特集一覧に戻る
        </Link>
      </div>
    );
  }

  const { Icon } = meta;

  return (
    <div className="flex-1 space-y-5 p-6 md:p-8 pt-6 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 min-h-screen text-slate-100">
      {/* Back button + Title */}
      <div>
        <Link
          href="/sales/featured"
          className="inline-flex items-center gap-1 text-sm text-slate-400 hover:text-slate-200 transition-colors mb-3"
        >
          <ChevronLeft className="h-4 w-4" />
          特集一覧に戻る
        </Link>

        <div className="flex items-center gap-3">
          <Icon className="h-7 w-7 text-emerald-400" />
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-white">
            {meta.title}
          </h1>
          {!loading && slug !== "by-area" && (
            <Badge className="bg-slate-800 text-slate-300 border-0 ml-2">
              {properties.length}件
            </Badge>
          )}
          {!loading && slug === "by-area" && (
            <Badge className="bg-slate-800 text-slate-300 border-0 ml-2">
              {areas.length}エリア
            </Badge>
          )}
        </div>
      </div>

      {/* Category tabs */}
      <div className="flex flex-wrap gap-2">
        {CATEGORY_TABS.map((tab) => (
          <Button
            key={tab.id}
            variant="outline"
            size="sm"
            onClick={() => setCategory(tab.id)}
            className={`min-h-[40px] px-4 text-sm ${
              category === tab.id
                ? "bg-emerald-600 text-white border-emerald-500 shadow-lg"
                : "bg-slate-800/50 border-slate-700 text-slate-300 hover:bg-slate-700"
            }`}
          >
            {tab.label}
          </Button>
        ))}
      </div>

      {/* Period selector for new-listings */}
      {slug === "new-listings" && (
        <div className="flex items-center gap-2">
          <span className="text-sm text-slate-400">期間:</span>
          {PERIOD_OPTIONS.map((opt) => (
            <Button
              key={opt.days}
              variant="outline"
              size="sm"
              onClick={() => setDays(opt.days)}
              className={`min-h-[36px] px-3 text-sm ${
                days === opt.days
                  ? "bg-blue-600 text-white border-blue-500 shadow-lg"
                  : "bg-slate-800/50 border-slate-700 text-slate-300 hover:bg-slate-700"
              }`}
            >
              {opt.label}
            </Button>
          ))}
        </div>
      )}

      {/* Content */}
      {slug === "by-area" ? (
        <AreaGrid areas={areas} loading={loading} />
      ) : (
        <FeaturedGrid
          properties={properties}
          loading={loading}
          badge={meta.badge}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// AreaGrid sub-component
// ---------------------------------------------------------------------------

function AreaGridSkeleton() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <div
          key={i}
          className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 animate-pulse"
        >
          <div className="h-5 bg-slate-800 rounded w-2/3 mb-3" />
          <div className="h-8 bg-slate-800 rounded w-1/2 mb-2" />
          <div className="h-3 bg-slate-800 rounded w-3/4 mb-1" />
          <div className="h-3 bg-slate-800 rounded w-1/2" />
        </div>
      ))}
    </div>
  );
}

function AreaGrid({
  areas,
  loading,
}: {
  areas: AreaItem[];
  loading: boolean;
}) {
  if (loading) return <AreaGridSkeleton />;

  if (areas.length === 0) {
    return (
      <div className="text-center py-20">
        <MapPin className="h-12 w-12 text-slate-600 mx-auto mb-4" />
        <p className="text-slate-400 text-lg">データがありません</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {areas
        .filter((a) => a.area !== "不明")
        .map((area) => {
          // Top 3 categories
          const topCats = Object.entries(area.categories)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3);

          return (
            <Card
              key={area.area}
              className="bg-slate-900/80 border-slate-800 p-4 hover:border-emerald-700/60 hover:shadow-lg hover:shadow-emerald-900/20 transition-all duration-200"
            >
              <div className="flex items-center gap-2 mb-2">
                <MapPin className="h-4 w-4 text-emerald-400 shrink-0" />
                <h3 className="text-base font-bold text-white truncate">
                  {area.area}
                </h3>
              </div>

              <p className="text-2xl font-bold text-emerald-400 mb-2">
                {area.count.toLocaleString()}
                <span className="text-sm text-slate-400 font-normal ml-1">
                  件
                </span>
              </p>

              {area.avgPrice > 0 && (
                <p className="text-xs text-slate-400 mb-2">
                  平均 {formatPrice(area.avgPrice)}
                </p>
              )}

              <div className="flex flex-wrap gap-1">
                {topCats.map(([cat, count]) => (
                  <Badge
                    key={cat}
                    className="bg-slate-800 text-slate-400 border-0 text-[10px] px-1.5 py-0"
                  >
                    {cat} {count}
                  </Badge>
                ))}
              </div>
            </Card>
          );
        })}
    </div>
  );
}
