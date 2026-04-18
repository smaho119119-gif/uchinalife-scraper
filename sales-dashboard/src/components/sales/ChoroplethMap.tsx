"use client";

import { useEffect, useRef, useMemo } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CityStats {
  name: string;
  count: number;
  avgPrice: number;
  medianPrice: number;
  avgPricePerTsubo: number;
  coordinates: [number, number];
  region: string;
}

interface ChoroplethMapProps {
  cities: CityStats[];
  onCityClick: (city: CityStats) => void;
  colorBy: "avgPrice" | "count" | "avgPricePerTsubo";
}

// ---------------------------------------------------------------------------
// Color scale helpers
// ---------------------------------------------------------------------------

/** Interpolate between green (low) and red (high) based on a 0-1 ratio */
function getColor(ratio: number): string {
  // Green → Yellow → Orange → Red
  const r = Math.round(Math.min(255, ratio * 2 * 255));
  const g = Math.round(Math.min(255, (1 - ratio) * 2 * 255));
  return `rgb(${r}, ${g}, 60)`;
}

/** Calculate circle radius based on property count (min 8, max 30) */
function getRadius(count: number, maxCount: number): number {
  if (maxCount === 0) return 8;
  const ratio = count / maxCount;
  return Math.max(8, Math.min(30, 8 + ratio * 22));
}

/** Format price for display */
function formatDisplayPrice(value: number): string {
  if (value >= 100_000_000) {
    const oku = (value / 100_000_000).toFixed(1);
    return `${oku}億`;
  }
  if (value >= 10_000) {
    const man = Math.round(value / 10_000);
    return `${man.toLocaleString()}万`;
  }
  return `${value.toLocaleString()}`;
}

// ---------------------------------------------------------------------------
// Label helpers
// ---------------------------------------------------------------------------

const METRIC_LABELS: Record<ChoroplethMapProps["colorBy"], string> = {
  avgPrice: "平均価格",
  count: "物件数",
  avgPricePerTsubo: "坪単価",
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ChoroplethMap({
  cities,
  onCityClick,
  colorBy,
}: ChoroplethMapProps) {
  const mapRef = useRef<L.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const circlesRef = useRef<L.CircleMarker[]>([]);
  const legendRef = useRef<L.Control | null>(null);

  // Compute min/max for the selected metric
  const { minVal, maxVal, maxCount } = useMemo(() => {
    if (cities.length === 0)
      return { minVal: 0, maxVal: 1, maxCount: 1 };

    const values = cities.map((c) => c[colorBy]).filter((v) => v > 0);
    const counts = cities.map((c) => c.count);

    return {
      minVal: values.length > 0 ? Math.min(...values) : 0,
      maxVal: values.length > 0 ? Math.max(...values) : 1,
      maxCount: Math.max(...counts, 1),
    };
  }, [cities, colorBy]);

  // Initialise map once
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = L.map(mapContainerRef.current, {
      zoomControl: true,
      attributionControl: true,
    }).setView([26.3344, 127.8056], 10);

    L.tileLayer(
      "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
      {
        attribution: "© OpenStreetMap © CARTO",
        maxZoom: 18,
      },
    ).addTo(map);

    mapRef.current = map;

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  // Draw circles & legend whenever cities/colorBy change
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Clear existing circles
    for (const c of circlesRef.current) {
      map.removeLayer(c);
    }
    circlesRef.current = [];

    // Remove old legend
    if (legendRef.current) {
      map.removeControl(legendRef.current);
      legendRef.current = null;
    }

    if (cities.length === 0) return;

    const range = maxVal - minVal || 1;

    // Add circle markers
    for (const city of cities) {
      const val = city[colorBy];
      const ratio = range > 0 ? Math.max(0, Math.min(1, (val - minVal) / range)) : 0;
      const color = getColor(ratio);
      const radius = getRadius(city.count, maxCount);

      // Tooltip content
      const tooltipContent = `
        <div style="font-size:13px;line-height:1.5;min-width:140px;">
          <strong style="font-size:14px;">${city.name}</strong><br/>
          物件数: <strong>${city.count}</strong><br/>
          平均価格: <strong>${city.avgPrice > 0 ? formatDisplayPrice(city.avgPrice) + "円" : "-"}</strong><br/>
          坪単価: <strong>${city.avgPricePerTsubo > 0 ? formatDisplayPrice(city.avgPricePerTsubo) + "円" : "-"}</strong>
        </div>
      `;

      const circle = L.circleMarker(city.coordinates, {
        radius,
        fillColor: color,
        color: "#fff",
        weight: 2,
        opacity: 0.9,
        fillOpacity: 0.75,
      })
        .bindTooltip(tooltipContent, {
          direction: "top",
          offset: [0, -radius],
          className: "choropleth-tooltip",
        })
        .on("click", () => onCityClick(city))
        .addTo(map);

      // Add city name label
      const labelIcon = L.divIcon({
        className: "city-label",
        html: `<span style="
          color: #fff;
          font-size: 11px;
          font-weight: 600;
          text-shadow: 0 1px 3px rgba(0,0,0,0.8);
          white-space: nowrap;
          pointer-events: none;
        ">${city.name}</span>`,
        iconSize: [0, 0],
        iconAnchor: [0, -radius - 4],
      });

      const label = L.marker(city.coordinates, { icon: labelIcon, interactive: false }).addTo(map);
      circlesRef.current.push(circle);
      // Store label for cleanup (treat as any since we just need removeLayer)
      circlesRef.current.push(label as unknown as L.CircleMarker);
    }

    // Add legend
    const legend = new L.Control({ position: "bottomright" });
    legend.onAdd = () => {
      const div = L.DomUtil.create("div", "choropleth-legend");
      const metricLabel = METRIC_LABELS[colorBy];
      const lowLabel =
        colorBy === "count"
          ? String(minVal)
          : formatDisplayPrice(minVal) + "円";
      const highLabel =
        colorBy === "count"
          ? String(maxVal)
          : formatDisplayPrice(maxVal) + "円";

      div.innerHTML = `
        <div style="
          background: rgba(15,23,42,0.9);
          backdrop-filter: blur(8px);
          border: 1px solid rgba(255,255,255,0.15);
          border-radius: 8px;
          padding: 10px 14px;
          color: #e2e8f0;
          font-size: 12px;
          min-width: 130px;
        ">
          <div style="font-weight:700; margin-bottom:6px; font-size:13px;">${metricLabel}</div>
          <div style="
            height: 12px;
            border-radius: 6px;
            background: linear-gradient(to right, rgb(0,255,60), rgb(255,255,60), rgb(255,128,60), rgb(255,0,60));
            margin-bottom: 4px;
          "></div>
          <div style="display:flex; justify-content:space-between; font-size:10px; color:#94a3b8;">
            <span>${lowLabel}</span>
            <span>${highLabel}</span>
          </div>
          <div style="margin-top:8px; font-size:10px; color:#94a3b8;">
            円の大きさ = 物件数
          </div>
        </div>
      `;
      return div;
    };
    legend.addTo(map);
    legendRef.current = legend;
  }, [cities, colorBy, minVal, maxVal, maxCount, onCityClick]);

  return (
    <div
      ref={mapContainerRef}
      className="h-full w-full rounded-xl overflow-hidden border border-slate-700"
      style={{ zIndex: 0, minHeight: "400px" }}
    />
  );
}
