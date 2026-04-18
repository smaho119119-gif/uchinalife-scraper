"use client";

import Link from "next/link";
import { PawPrint, Sparkles, MapPin, ArrowRight, ChevronLeft } from "lucide-react";
import { Card } from "@/components/ui/card";

const COLLECTIONS = [
  {
    slug: "pet-friendly",
    title: "ペット可物件",
    description: "ペット飼育可能な賃貸・売買物件",
    Icon: PawPrint,
    colorFrom: "from-orange-500",
    colorTo: "to-amber-600",
    iconBg: "bg-orange-500/20",
    iconColor: "text-orange-400",
    borderHover: "hover:border-orange-700/60",
    shadowHover: "hover:shadow-orange-900/20",
  },
  {
    slug: "new-listings",
    title: "新着物件",
    description: "直近7日以内に登録された最新物件",
    Icon: Sparkles,
    colorFrom: "from-blue-500",
    colorTo: "to-cyan-600",
    iconBg: "bg-blue-500/20",
    iconColor: "text-blue-400",
    borderHover: "hover:border-blue-700/60",
    shadowHover: "hover:shadow-blue-900/20",
  },
  {
    slug: "by-area",
    title: "エリア別",
    description: "市町村ごとの物件数と平均価格を一覧表示",
    Icon: MapPin,
    colorFrom: "from-emerald-500",
    colorTo: "to-green-600",
    iconBg: "bg-emerald-500/20",
    iconColor: "text-emerald-400",
    borderHover: "hover:border-emerald-700/60",
    shadowHover: "hover:shadow-emerald-900/20",
  },
];

export default function FeaturedPage() {
  return (
    <div className="flex-1 space-y-6 p-6 md:p-8 pt-6 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 min-h-screen text-slate-100">
      {/* Header */}
      <div>
        <Link
          href="/sales/market-price"
          className="inline-flex items-center gap-1 text-sm text-slate-400 hover:text-slate-200 transition-colors mb-4"
        >
          <ChevronLeft className="h-4 w-4" />
          ダッシュボードに戻る
        </Link>
        <h1 className="text-3xl font-bold tracking-tight text-white">
          特集コレクション
        </h1>
        <p className="text-slate-400 mt-1">
          条件別に厳選された物件をまとめて閲覧できます
        </p>
      </div>

      {/* Collection Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {COLLECTIONS.map((col) => {
          const { Icon } = col;
          return (
            <Link key={col.slug} href={`/sales/featured/${col.slug}`}>
              <Card
                className={`group bg-slate-900/80 border-slate-800 backdrop-blur-sm p-6 cursor-pointer transition-all duration-200 ${col.borderHover} hover:shadow-lg ${col.shadowHover} focus-within:ring-2 focus-within:ring-emerald-500`}
              >
                <div className="flex items-start justify-between mb-4">
                  <div
                    className={`w-12 h-12 rounded-xl ${col.iconBg} flex items-center justify-center`}
                  >
                    <Icon className={`h-6 w-6 ${col.iconColor}`} />
                  </div>
                  <ArrowRight className="h-5 w-5 text-slate-600 group-hover:text-slate-300 group-hover:translate-x-1 transition-all" />
                </div>

                <h2 className="text-xl font-bold text-white mb-1 group-hover:text-emerald-300 transition-colors">
                  {col.title}
                </h2>
                <p className="text-sm text-slate-400 leading-relaxed">
                  {col.description}
                </p>

                {/* Gradient bar */}
                <div
                  className={`mt-4 h-1 w-full rounded-full bg-gradient-to-r ${col.colorFrom} ${col.colorTo} opacity-40 group-hover:opacity-100 transition-opacity`}
                />
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
