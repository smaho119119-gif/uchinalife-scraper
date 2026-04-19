"use client";

import { BarChart3 } from "lucide-react";
import MarketPriceCalculator from "@/components/sales/MarketPriceCalculator";

export default function MarketPricePage() {
  return (
    <div className="flex-1 p-8 pt-6 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 min-h-screen text-slate-100">
      {/* Header */}
      <div className="mb-8">
        <h2 className="text-3xl font-bold tracking-tight text-white flex items-center gap-3">
          <BarChart3 className="h-8 w-8 text-emerald-400" />
          相場価格ツール
        </h2>
        <p className="text-slate-400 mt-1">
          エリアとカテゴリを選んで、沖縄の不動産相場をチェック
        </p>
      </div>

      {/* Calculator */}
      <MarketPriceCalculator />
    </div>
  );
}
