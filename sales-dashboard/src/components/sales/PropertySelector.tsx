"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Search,
  Building2,
  Home,
  CheckCircle2,
  Loader2,
} from "lucide-react";

interface PropertyItem {
  url: string;
  title: string;
  price: string;
  company_name: string;
  category_type: string;
  category_name_ja: string;
  genre_name_ja: string;
  property_data: Record<string, string> | null;
  is_active: boolean;
}

interface Props {
  selectedUrls: string[];
  onSelectionChange: (urls: string[]) => void;
  maxSelection?: number;
}

const ITEMS_PER_PAGE = 20;

export default function PropertySelector({
  selectedUrls,
  onSelectionChange,
  maxSelection = 10,
}: Props) {
  const [properties, setProperties] = useState<PropertyItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<
    "all" | "rent" | "buy"
  >("all");
  const [visibleCount, setVisibleCount] = useState(ITEMS_PER_PAGE);

  useEffect(() => {
    fetch("/api/properties?limit=50000")
      .then((res) => res.json())
      .then((data) => {
        setProperties(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    return properties.filter((p) => {
      // Category filter
      if (categoryFilter === "rent" && p.category_type !== "賃貸") return false;
      if (categoryFilter === "buy" && p.category_type !== "売買") return false;

      // Search
      if (searchTerm) {
        const q = searchTerm.toLowerCase();
        const title = (p.title || "").toLowerCase();
        const company = (p.company_name || "").toLowerCase();
        const location = (
          p.property_data?.["所在地"] ||
          p.property_data?.["住所"] ||
          p.property_data?.["物件所在地"] ||
          ""
        ).toLowerCase();
        if (
          !title.includes(q) &&
          !company.includes(q) &&
          !location.includes(q)
        ) {
          return false;
        }
      }

      return true;
    });
  }, [properties, searchTerm, categoryFilter]);

  // Reset visible count when filters change
  useEffect(() => {
    setVisibleCount(ITEMS_PER_PAGE);
  }, [searchTerm, categoryFilter]);

  const visibleProperties = filtered.slice(0, visibleCount);

  const toggleProperty = useCallback(
    (url: string) => {
      if (selectedUrls.includes(url)) {
        onSelectionChange(selectedUrls.filter((u) => u !== url));
      } else {
        if (selectedUrls.length >= maxSelection) return;
        onSelectionChange([...selectedUrls, url]);
      }
    },
    [selectedUrls, onSelectionChange, maxSelection]
  );

  const getLocation = (p: PropertyItem) => {
    if (!p.property_data) return "";
    return (
      p.property_data["所在地"] ||
      p.property_data["住所"] ||
      p.property_data["物件所在地"] ||
      ""
    );
  };

  return (
    <div className="space-y-4">
      {/* Header with count */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white">物件を選択</h3>
        <Badge
          className={`text-sm px-3 py-1 ${
            selectedUrls.length > 0
              ? "bg-emerald-900/60 text-emerald-300 border-emerald-700"
              : "bg-slate-800 text-slate-400 border-slate-700"
          }`}
        >
          <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
          {selectedUrls.length} / {maxSelection} 選択
        </Badge>
      </div>

      {/* Category tabs */}
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setCategoryFilter("all")}
          className={
            categoryFilter === "all"
              ? "bg-gradient-to-r from-slate-600 to-slate-700 text-white border-transparent shadow-lg"
              : "bg-slate-800/50 border-slate-700 text-slate-300 hover:bg-slate-700"
          }
        >
          全て
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setCategoryFilter("rent")}
          className={
            categoryFilter === "rent"
              ? "bg-gradient-to-r from-blue-600 to-cyan-600 text-white border-transparent shadow-lg shadow-blue-500/30"
              : "bg-slate-800/50 border-blue-800/50 text-blue-300 hover:bg-blue-900/30"
          }
        >
          <Building2 className="h-4 w-4 mr-1" /> 賃貸
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setCategoryFilter("buy")}
          className={
            categoryFilter === "buy"
              ? "bg-gradient-to-r from-orange-600 to-amber-600 text-white border-transparent shadow-lg shadow-orange-500/30"
              : "bg-slate-800/50 border-orange-800/50 text-orange-300 hover:bg-orange-900/30"
          }
        >
          <Home className="h-4 w-4 mr-1" /> 売買
        </Button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <Input
          type="text"
          placeholder="物件名、会社名、エリアで検索..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10 bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 focus:border-emerald-500 focus:ring-emerald-500"
        />
      </div>

      {/* Results count */}
      <p className="text-xs text-slate-500">
        {filtered.length.toLocaleString()} 件ヒット
      </p>

      {/* Property list */}
      {loading ? (
        <div className="flex items-center justify-center py-12 text-slate-400">
          <Loader2 className="h-5 w-5 animate-spin mr-2" />
          読み込み中...
        </div>
      ) : (
        <div className="space-y-2 max-h-[480px] overflow-y-auto pr-1">
          {visibleProperties.map((p) => {
            const isSelected = selectedUrls.includes(p.url);
            const isDisabled =
              !isSelected && selectedUrls.length >= maxSelection;
            return (
              <Card
                key={p.url}
                className={`cursor-pointer transition-all duration-150 ${
                  isSelected
                    ? "bg-emerald-900/30 border-emerald-600 shadow-lg shadow-emerald-900/20"
                    : isDisabled
                    ? "bg-slate-900/40 border-slate-800 opacity-50 cursor-not-allowed"
                    : "bg-slate-900/60 border-slate-800 hover:border-slate-600 hover:bg-slate-800/60"
                }`}
                onClick={() => !isDisabled && toggleProperty(p.url)}
              >
                <CardContent className="p-3 flex items-start gap-3">
                  <div className="pt-0.5">
                    <Checkbox
                      checked={isSelected}
                      disabled={isDisabled}
                      className={
                        isSelected
                          ? "border-emerald-500 bg-emerald-600 data-[state=checked]:bg-emerald-600 data-[state=checked]:border-emerald-500"
                          : "border-slate-600"
                      }
                      onCheckedChange={() =>
                        !isDisabled && toggleProperty(p.url)
                      }
                      onClick={(e) => e.stopPropagation()}
                      aria-label={`${p.title}を選択`}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium text-white truncate">
                        {p.title}
                      </p>
                      <Badge
                        className={`shrink-0 text-[10px] px-2 py-0.5 ${
                          p.category_type === "賃貸"
                            ? "bg-blue-900/50 text-blue-300 border-blue-800"
                            : "bg-orange-900/50 text-orange-300 border-orange-800"
                        }`}
                      >
                        {p.category_type}
                      </Badge>
                    </div>
                    <p className="text-emerald-400 text-sm font-bold mt-0.5">
                      {p.price || "価格未定"}
                    </p>
                    <div className="flex items-center gap-3 mt-1 text-xs text-slate-400">
                      <span>{p.company_name}</span>
                      {getLocation(p) && (
                        <span className="truncate">{getLocation(p)}</span>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}

          {visibleProperties.length === 0 && !loading && (
            <div className="text-center py-8 text-slate-500">
              条件に一致する物件がありません
            </div>
          )}
        </div>
      )}

      {/* Load more */}
      {visibleCount < filtered.length && (
        <Button
          variant="outline"
          className="w-full bg-slate-800/50 border-slate-700 text-slate-300 hover:bg-slate-700"
          onClick={() => setVisibleCount((prev) => prev + ITEMS_PER_PAGE)}
        >
          さらに表示 ({filtered.length - visibleCount} 件)
        </Button>
      )}
    </div>
  );
}
