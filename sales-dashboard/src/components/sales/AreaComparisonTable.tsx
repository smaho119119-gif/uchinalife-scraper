"use client";

import { useState, useMemo } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatPrice } from "@/lib/price";
import { ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";

interface AreaRow {
  area: string;
  count: number;
  avg: number;
  median: number;
  min: number;
  max: number;
}

interface Props {
  data: AreaRow[];
  currentArea: string;
  isRental: boolean;
}

type SortKey = keyof AreaRow;
type SortDir = "asc" | "desc";

const COLUMNS: { key: SortKey; label: string }[] = [
  { key: "area", label: "エリア" },
  { key: "count", label: "件数" },
  { key: "avg", label: "平均" },
  { key: "median", label: "中央値" },
  { key: "min", label: "最安" },
  { key: "max", label: "最高" },
];

export default function AreaComparisonTable({
  data,
  currentArea,
  isRental,
}: Props) {
  const [sortKey, setSortKey] = useState<SortKey>("avg");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "area" ? "asc" : "desc");
    }
  };

  const sorted = useMemo(() => {
    return [...data].sort((a, b) => {
      const aVal = a[sortKey];
      const bVal = b[sortKey];
      if (typeof aVal === "string" && typeof bVal === "string") {
        return sortDir === "asc"
          ? aVal.localeCompare(bVal, "ja")
          : bVal.localeCompare(aVal, "ja");
      }
      const diff = (aVal as number) - (bVal as number);
      return sortDir === "asc" ? diff : -diff;
    });
  }, [data, sortKey, sortDir]);

  const displayPrice = (value: number) => {
    if (isRental) {
      // Rental: display as 万円 (value is already yen)
      if (value >= 10000) {
        return `${(value / 10000).toFixed(1)}万円`;
      }
      return `${value.toLocaleString()}円`;
    }
    return formatPrice(value);
  };

  const SortIcon = ({ columnKey }: { columnKey: SortKey }) => {
    if (sortKey !== columnKey) {
      return <ArrowUpDown className="h-3 w-3 ml-1 opacity-40" />;
    }
    return sortDir === "asc" ? (
      <ArrowUp className="h-3 w-3 ml-1 text-emerald-400" />
    ) : (
      <ArrowDown className="h-3 w-3 ml-1 text-emerald-400" />
    );
  };

  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 text-slate-500">
        エリア比較データがありません
      </div>
    );
  }

  return (
    <div className="w-full">
      <h3 className="text-sm font-semibold text-slate-300 mb-4">
        エリア別比較
      </h3>
      <div className="rounded-lg border border-slate-700 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-slate-700 hover:bg-transparent">
              {COLUMNS.map((col) => (
                <TableHead
                  key={col.key}
                  className="text-slate-400 cursor-pointer select-none min-h-[44px] hover:text-slate-200 transition-colors"
                  onClick={() => handleSort(col.key)}
                >
                  <span className="inline-flex items-center">
                    {col.label}
                    <SortIcon columnKey={col.key} />
                  </span>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.map((row) => {
              const isCurrent = row.area === currentArea;
              return (
                <TableRow
                  key={row.area}
                  className={
                    isCurrent
                      ? "bg-emerald-900/40 border-slate-700 hover:bg-emerald-900/50"
                      : "border-slate-800 hover:bg-slate-800/50"
                  }
                >
                  <TableCell
                    className={
                      isCurrent
                        ? "font-bold text-emerald-300"
                        : "text-slate-200"
                    }
                  >
                    {row.area}
                    {isCurrent && (
                      <span className="ml-2 text-xs text-emerald-400">
                        (選択中)
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-slate-300 tabular-nums">
                    {row.count.toLocaleString()}
                  </TableCell>
                  <TableCell
                    className={
                      isCurrent
                        ? "text-emerald-300 font-semibold tabular-nums"
                        : "text-slate-300 tabular-nums"
                    }
                  >
                    {displayPrice(row.avg)}
                  </TableCell>
                  <TableCell className="text-slate-300 tabular-nums">
                    {displayPrice(row.median)}
                  </TableCell>
                  <TableCell className="text-slate-400 tabular-nums">
                    {displayPrice(row.min)}
                  </TableCell>
                  <TableCell className="text-slate-400 tabular-nums">
                    {displayPrice(row.max)}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
