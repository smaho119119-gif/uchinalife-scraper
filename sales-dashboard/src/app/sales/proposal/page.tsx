"use client";

import { useState } from "react";
import { FileText, Loader2 } from "lucide-react";
import ProposalBuilder from "@/components/sales/ProposalBuilder";
import type { ProposalData } from "@/components/sales/ProposalBuilder";
import ProposalPreview from "@/components/sales/ProposalPreview";
import type { Property } from '@/lib/types';
import { extractCityName } from "@/lib/area";
import { parsePrice, calcMarketStats } from "@/lib/price";

interface MarketDataItem {
  area: string;
  avg: number;
  median: number;
}

export default function ProposalPage() {
  const [mode, setMode] = useState<"build" | "preview">("build");
  const [loading, setLoading] = useState(false);
  const [proposal, setProposal] = useState<ProposalData | null>(null);
  const [properties, setProperties] = useState<Property[]>([]);
  const [marketData, setMarketData] = useState<MarketDataItem[]>([]);

  const handlePreview = async (data: ProposalData) => {
    setLoading(true);
    setProposal(data);

    try {
      // Fetch full property data
      const encoded = data.propertyUrls
        .map((u) => encodeURIComponent(u))
        .join(",");
      const res = await fetch(`/api/sales/proposal?urls=${encoded}`);
      const props: Property[] = await res.json();
      setProperties(props);

      // Calculate market data if requested
      if (data.includeMarketData && props.length > 0) {
        const areaMarket = await calculateMarketData(props);
        setMarketData(areaMarket);
      } else {
        setMarketData([]);
      }

      setMode("preview");
    } catch (error) {
      console.error("Failed to load preview data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    setMode("build");
  };

  return (
    <div className="flex-1 p-8 pt-6 min-h-screen">
      {mode === "build" && (
        <div className="bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 min-h-full -m-8 -mt-6 p-8 pt-6">
          {/* Header */}
          <div className="mb-6">
            <h2 className="text-3xl font-bold tracking-tight text-white flex items-center gap-3">
              <FileText className="h-8 w-8 text-emerald-400" />
              物件提案シート
            </h2>
            <p className="text-slate-400 mt-1">
              お客様への物件提案書を作成します
            </p>
          </div>

          <div className="max-w-3xl">
            <ProposalBuilder onPreview={handlePreview} />
          </div>

          {/* Loading overlay */}
          {loading && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center">
              <div className="bg-slate-900 border border-slate-700 rounded-xl p-8 flex flex-col items-center gap-4 shadow-2xl">
                <Loader2 className="h-8 w-8 animate-spin text-emerald-400" />
                <p className="text-white font-medium">
                  提案書を生成中...
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {mode === "preview" && proposal && (
        <div className="bg-gray-100 min-h-full -m-8 -mt-6 p-8 pt-6 print:bg-white print:p-0 print:m-0">
          <div className="max-w-4xl mx-auto">
            <ProposalPreview
              proposal={proposal}
              properties={properties}
              marketData={marketData.length > 0 ? marketData : undefined}
              onBack={handleBack}
            />
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Calculate market data for each unique city among the proposal properties.
 * Fetches area-level properties and computes avg/median prices.
 */
async function calculateMarketData(
  props: Property[]
): Promise<MarketDataItem[]> {
  // Extract unique cities from the properties
  const cities = new Set<string>();
  for (const p of props) {
    const location =
      p.property_data?.["所在地"] ||
      p.property_data?.["住所"] ||
      p.property_data?.["物件所在地"] ||
      "";
    const city = extractCityName(location);
    if (city && city !== "不明") {
      cities.add(city);
    }
  }

  if (cities.size === 0) return [];

  // Fetch all active properties to compute stats per city
  try {
    const res = await fetch("/api/properties?limit=50000");
    const allProps: Property[] = await res.json();

    const results: MarketDataItem[] = [];
    for (const city of cities) {
      const cityProps = allProps.filter((p) => {
        const loc =
          p.property_data?.["所在地"] ||
          p.property_data?.["住所"] ||
          p.property_data?.["物件所在地"] ||
          "";
        return loc.includes(city);
      });

      const prices = cityProps
        .map((p) => parsePrice(p.price))
        .filter((v): v is number => v !== null && v > 0);

      const stats = calcMarketStats(prices);
      if (stats) {
        results.push({
          area: city,
          avg: stats.avg,
          median: stats.median,
        });
      }
    }

    return results;
  } catch {
    return [];
  }
}
