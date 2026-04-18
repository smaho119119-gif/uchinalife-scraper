"use client";

import { Button } from "@/components/ui/button";
import { ArrowLeft, Printer } from "lucide-react";
import type { ProposalData } from "./ProposalBuilder";
import type { Property } from "@/lib/supabase";
import { extractCityName } from "@/lib/area";
import { formatPrice, parsePrice } from "@/lib/price";

interface MarketDataItem {
  area: string;
  avg: number;
  median: number;
}

interface Props {
  proposal: ProposalData;
  properties: Property[];
  marketData?: MarketDataItem[];
  onBack: () => void;
}

function getDetail(
  data: Record<string, string> | null | undefined,
  ...keys: string[]
): string {
  if (!data) return "";
  for (const key of keys) {
    if (data[key]) return data[key];
  }
  return "";
}

export default function ProposalPreview({
  proposal,
  properties,
  marketData,
  onBack,
}: Props) {
  const today = new Date();
  const dateStr = `${today.getFullYear()}年${
    today.getMonth() + 1
  }月${today.getDate()}日`;

  const clientLabel = proposal.clientName
    ? `${proposal.clientName} 様`
    : "お客様";

  return (
    <>
      {/* Action bar (hidden in print) */}
      <div className="print:hidden flex items-center justify-between mb-6 bg-slate-900/80 border border-slate-800 rounded-xl p-4 backdrop-blur-sm">
        <Button
          variant="outline"
          onClick={onBack}
          className="bg-slate-800/50 border-slate-700 text-slate-300 hover:bg-slate-700 min-h-[44px]"
        >
          <ArrowLeft className="h-4 w-4 mr-2" /> 戻る
        </Button>
        <Button
          onClick={() => window.print()}
          className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-lg hover:from-emerald-500 hover:to-teal-500 min-h-[44px]"
        >
          <Printer className="h-4 w-4 mr-2" /> 印刷
        </Button>
      </div>

      {/* Printable content */}
      <div className="proposal-print-area bg-white text-gray-900 rounded-xl overflow-hidden print:rounded-none print:shadow-none shadow-xl">
        {/* Cover / Header */}
        <div className="px-10 pt-10 pb-6 border-b-2 border-gray-200 print:px-8 print:pt-8">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-gray-500 mb-1">{dateStr}</p>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">
                物件ご提案書
              </h1>
              <p className="text-lg text-gray-700">
                {clientLabel}
                {proposal.clientCompany && (
                  <span className="text-sm text-gray-500 ml-2">
                    ({proposal.clientCompany})
                  </span>
                )}
              </p>
            </div>
            <div className="text-right">
              <div className="w-16 h-16 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-xl flex items-center justify-center print:from-gray-400 print:to-gray-500">
                <span className="text-white text-2xl font-bold">R</span>
              </div>
              <p className="text-xs text-gray-400 mt-1">Real Estate</p>
            </div>
          </div>
          {proposal.notes && (
            <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-100">
              <p className="text-sm text-gray-600 whitespace-pre-wrap">
                {proposal.notes}
              </p>
            </div>
          )}
        </div>

        {/* Properties */}
        <div className="px-10 py-6 print:px-8">
          <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
            <span className="w-1 h-5 bg-emerald-500 rounded-full inline-block print:bg-gray-500" />
            ご提案物件 ({properties.length}件)
          </h2>

          <div className="space-y-0">
            {properties.map((property, index) => {
              const pd = property.property_data;
              const location = getDetail(
                pd,
                "所在地",
                "住所",
                "物件所在地"
              );
              const madori = getDetail(pd, "間取り", "間取");
              const menseki = getDetail(
                pd,
                "専有面積",
                "建物面積",
                "面積",
                "土地面積"
              );
              const chikunen = getDetail(
                pd,
                "築年月",
                "築年",
                "築年数",
                "建築年月"
              );
              const firstImage =
                property.images && property.images.length > 0
                  ? property.images[0]
                  : null;

              return (
                <div
                  key={property.url}
                  className="py-5 border-b border-gray-100 last:border-0 print:break-inside-avoid"
                >
                  <div className="flex gap-5">
                    {/* Image */}
                    {firstImage && (
                      <div className="shrink-0 w-40 h-28 rounded-lg overflow-hidden bg-gray-100">
                        <img
                          src={firstImage}
                          alt={property.title}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      </div>
                    )}

                    {/* Details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-xs text-gray-400 mb-0.5">
                            物件 {index + 1}
                          </p>
                          <h3 className="text-base font-bold text-gray-900 leading-tight">
                            {property.title}
                          </h3>
                        </div>
                        <p className="text-lg font-bold text-emerald-600 shrink-0 print:text-gray-900">
                          {property.price || "価格未定"}
                        </p>
                      </div>

                      <div className="grid grid-cols-2 gap-x-6 gap-y-1 mt-3 text-sm">
                        {location && (
                          <div className="flex">
                            <span className="text-gray-400 w-14 shrink-0">
                              住所
                            </span>
                            <span className="text-gray-700">{location}</span>
                          </div>
                        )}
                        {madori && (
                          <div className="flex">
                            <span className="text-gray-400 w-14 shrink-0">
                              間取り
                            </span>
                            <span className="text-gray-700">{madori}</span>
                          </div>
                        )}
                        {menseki && (
                          <div className="flex">
                            <span className="text-gray-400 w-14 shrink-0">
                              面積
                            </span>
                            <span className="text-gray-700">{menseki}</span>
                          </div>
                        )}
                        {chikunen && (
                          <div className="flex">
                            <span className="text-gray-400 w-14 shrink-0">
                              築年月
                            </span>
                            <span className="text-gray-700">{chikunen}</span>
                          </div>
                        )}
                      </div>

                      <p className="text-xs text-gray-400 mt-2">
                        {property.company_name}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Market data section */}
        {proposal.includeMarketData &&
          marketData &&
          marketData.length > 0 && (
            <div className="px-10 py-6 border-t-2 border-gray-200 print:px-8 print:break-before-page">
              <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                <span className="w-1 h-5 bg-blue-500 rounded-full inline-block print:bg-gray-500" />
                エリア相場データ
              </h2>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b-2 border-gray-200">
                      <th className="text-left py-2 px-3 text-gray-500 font-semibold">
                        エリア
                      </th>
                      <th className="text-right py-2 px-3 text-gray-500 font-semibold">
                        平均価格
                      </th>
                      <th className="text-right py-2 px-3 text-gray-500 font-semibold">
                        中央値
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {marketData.map((m) => (
                      <tr
                        key={m.area}
                        className="border-b border-gray-100"
                      >
                        <td className="py-2 px-3 text-gray-700 font-medium">
                          {m.area}
                        </td>
                        <td className="py-2 px-3 text-right text-gray-700">
                          {formatPrice(m.avg)}
                        </td>
                        <td className="py-2 px-3 text-right text-gray-700">
                          {formatPrice(m.median)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <p className="text-xs text-gray-400 mt-3">
                ※ 相場データは現在掲載中の物件から算出した参考値です
              </p>
            </div>
          )}

        {/* Footer */}
        <div className="px-10 py-4 bg-gray-50 border-t border-gray-200 print:px-8">
          <div className="flex items-center justify-between text-xs text-gray-400">
            <p>本資料の内容は作成時点の情報に基づきます</p>
            <p>{dateStr} 作成</p>
          </div>
        </div>
      </div>

      {/* Print styles */}
      <style jsx global>{`
        @media print {
          /* Hide everything except the proposal */
          body * {
            visibility: hidden;
          }
          .proposal-print-area,
          .proposal-print-area * {
            visibility: visible;
          }
          .proposal-print-area {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            background: white !important;
            color: #111 !important;
            border-radius: 0 !important;
            box-shadow: none !important;
          }
          .print\\:hidden {
            display: none !important;
          }

          /* Page setup */
          @page {
            margin: 15mm;
            size: A4;
          }

          /* Page breaks */
          .print\\:break-before-page {
            break-before: page;
          }
          .print\\:break-inside-avoid {
            break-inside: avoid;
          }

          /* White background for everything */
          html,
          body {
            background: white !important;
          }
        }
      `}</style>
    </>
  );
}
