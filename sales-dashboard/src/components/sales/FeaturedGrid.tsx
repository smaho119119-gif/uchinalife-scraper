"use client";

import { Badge } from "@/components/ui/badge";
import { Building2, MapPin, ImageOff } from "lucide-react";

export interface FeaturedProperty {
  url: string;
  title: string;
  price: string;
  category: string;
  genre_name_ja: string;
  images: string[];
  company_name: string;
  location?: string;
  madori?: string;
  pet_info?: string;
}

interface Props {
  properties: FeaturedProperty[];
  loading: boolean;
  badge?: string;
}

function formatDisplayPrice(priceStr: string | null | undefined): string {
  if (!priceStr) return "価格未定";
  return priceStr;
}

function SkeletonCard() {
  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-xl overflow-hidden animate-pulse">
      <div className="aspect-[4/3] bg-slate-800" />
      <div className="p-4 space-y-3">
        <div className="h-4 bg-slate-800 rounded w-3/4" />
        <div className="h-5 bg-slate-800 rounded w-1/2" />
        <div className="h-3 bg-slate-800 rounded w-2/3" />
        <div className="h-3 bg-slate-800 rounded w-1/3" />
      </div>
    </div>
  );
}

export default function FeaturedGrid({ properties, loading, badge }: Props) {
  if (loading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    );
  }

  if (properties.length === 0) {
    return (
      <div className="text-center py-20">
        <ImageOff className="h-12 w-12 text-slate-600 mx-auto mb-4" />
        <p className="text-slate-400 text-lg">該当する物件がありません</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {properties.map((prop) => (
        <a
          key={prop.url}
          href={prop.url}
          target="_blank"
          rel="noopener noreferrer"
          className="group bg-slate-900/80 border border-slate-800 rounded-xl overflow-hidden hover:border-emerald-700/60 hover:shadow-lg hover:shadow-emerald-900/20 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 focus:ring-offset-slate-950"
        >
          {/* Image */}
          <div className="aspect-[4/3] bg-slate-800 relative overflow-hidden">
            {prop.images && prop.images.length > 0 ? (
              <img
                src={prop.images[0]}
                alt={prop.title}
                loading="lazy"
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Building2 className="h-10 w-10 text-slate-700" />
              </div>
            )}

            {/* Badge */}
            {badge && (
              <div className="absolute top-2 left-2">
                <Badge className="bg-emerald-600 text-white border-0 text-xs px-2 py-0.5 shadow-md">
                  {badge}
                </Badge>
              </div>
            )}

            {/* Pet info badge */}
            {prop.pet_info && (
              <div className="absolute top-2 right-2">
                <Badge className="bg-orange-600 text-white border-0 text-xs px-2 py-0.5 shadow-md">
                  {prop.pet_info}
                </Badge>
              </div>
            )}

            {/* Category */}
            <div className="absolute bottom-2 left-2">
              <Badge className="bg-slate-900/80 text-slate-300 border-0 text-xs px-2 py-0.5 backdrop-blur-sm">
                {prop.genre_name_ja || prop.category}
              </Badge>
            </div>
          </div>

          {/* Content */}
          <div className="p-3 space-y-1.5">
            <h3 className="text-sm font-medium text-white truncate group-hover:text-emerald-300 transition-colors">
              {prop.title}
            </h3>

            <p className="text-emerald-400 font-bold text-base">
              {formatDisplayPrice(prop.price)}
            </p>

            {prop.madori && (
              <p className="text-xs text-slate-400">{prop.madori}</p>
            )}

            {prop.location && (
              <p className="text-xs text-slate-500 flex items-center gap-1 truncate">
                <MapPin className="h-3 w-3 shrink-0" />
                {prop.location}
              </p>
            )}

            <p className="text-xs text-slate-600 truncate">
              {prop.company_name}
            </p>
          </div>
        </a>
      ))}
    </div>
  );
}
