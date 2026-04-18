"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  FileText,
  Eye,
  ChevronUp,
  ChevronDown,
  X,
  Save,
  BarChart3,
  User,
  Building,
  StickyNote,
  ListChecks,
} from "lucide-react";
import PropertySelector from "./PropertySelector";

export interface ProposalData {
  clientName: string;
  clientCompany: string;
  notes: string;
  propertyUrls: string[];
  includeMarketData: boolean;
}

interface Props {
  onPreview: (proposal: ProposalData) => void;
}

const STORAGE_KEY = "uchina-proposal-draft";

export default function ProposalBuilder({ onPreview }: Props) {
  const [clientName, setClientName] = useState("");
  const [clientCompany, setClientCompany] = useState("");
  const [notes, setNotes] = useState("");
  const [selectedUrls, setSelectedUrls] = useState<string[]>([]);
  const [includeMarketData, setIncludeMarketData] = useState(false);

  // Property titles cache for display
  const [propertyTitles, setPropertyTitles] = useState<
    Record<string, string>
  >({});

  // Load draft from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const draft = JSON.parse(saved) as ProposalData;
        setClientName(draft.clientName || "");
        setClientCompany(draft.clientCompany || "");
        setNotes(draft.notes || "");
        setSelectedUrls(draft.propertyUrls || []);
        setIncludeMarketData(draft.includeMarketData || false);
      }
    } catch {
      // ignore
    }
  }, []);

  // Save draft to localStorage on changes
  useEffect(() => {
    try {
      const draft: ProposalData = {
        clientName,
        clientCompany,
        notes,
        propertyUrls: selectedUrls,
        includeMarketData,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
    } catch {
      // ignore
    }
  }, [clientName, clientCompany, notes, selectedUrls, includeMarketData]);

  // Fetch titles for selected URLs
  useEffect(() => {
    if (selectedUrls.length === 0) return;

    const missing = selectedUrls.filter((u) => !propertyTitles[u]);
    if (missing.length === 0) return;

    const encoded = missing.map((u) => encodeURIComponent(u)).join(",");
    fetch(`/api/sales/proposal?urls=${encoded}`)
      .then((res) => res.json())
      .then((data: Array<{ url: string; title: string }>) => {
        const map: Record<string, string> = {};
        for (const p of data) {
          map[p.url] = p.title;
        }
        setPropertyTitles((prev) => ({ ...prev, ...map }));
      })
      .catch(() => {});
  }, [selectedUrls, propertyTitles]);

  const handleSelectionChange = useCallback((urls: string[]) => {
    setSelectedUrls(urls);
  }, []);

  const moveProperty = (index: number, direction: "up" | "down") => {
    const newUrls = [...selectedUrls];
    const swapIndex = direction === "up" ? index - 1 : index + 1;
    if (swapIndex < 0 || swapIndex >= newUrls.length) return;
    [newUrls[index], newUrls[swapIndex]] = [
      newUrls[swapIndex],
      newUrls[index],
    ];
    setSelectedUrls(newUrls);
  };

  const removeProperty = (url: string) => {
    setSelectedUrls((prev) => prev.filter((u) => u !== url));
  };

  const handlePreview = () => {
    onPreview({
      clientName,
      clientCompany,
      notes,
      propertyUrls: selectedUrls,
      includeMarketData,
    });
  };

  const handleClearDraft = () => {
    setClientName("");
    setClientCompany("");
    setNotes("");
    setSelectedUrls([]);
    setIncludeMarketData(false);
    localStorage.removeItem(STORAGE_KEY);
  };

  const canPreview = selectedUrls.length > 0;

  return (
    <div className="space-y-6">
      {/* Client info */}
      <Card className="bg-slate-900/80 border-slate-800 backdrop-blur-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-white flex items-center gap-2 text-base">
            <User className="h-4 w-4 text-emerald-400" />
            お客様情報
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-slate-300">
                お客様名
              </Label>
              <Input
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder="山田 太郎"
                className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 focus:border-emerald-500"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-slate-300">
                会社名
              </Label>
              <Input
                value={clientCompany}
                onChange={(e) => setClientCompany(e.target.value)}
                placeholder="株式会社○○"
                className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 focus:border-emerald-500"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Property selector */}
      <Card className="bg-slate-900/80 border-slate-800 backdrop-blur-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-white flex items-center gap-2 text-base">
            <ListChecks className="h-4 w-4 text-emerald-400" />
            提案物件
          </CardTitle>
        </CardHeader>
        <CardContent>
          <PropertySelector
            selectedUrls={selectedUrls}
            onSelectionChange={handleSelectionChange}
            maxSelection={10}
          />
        </CardContent>
      </Card>

      {/* Selected properties preview (reorderable) */}
      {selectedUrls.length > 0 && (
        <Card className="bg-slate-900/80 border-slate-800 backdrop-blur-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-white flex items-center gap-2 text-base">
              <FileText className="h-4 w-4 text-emerald-400" />
              選択済み物件 ({selectedUrls.length}件)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {selectedUrls.map((url, index) => (
              <div
                key={url}
                className="flex items-center gap-2 bg-slate-800/60 border border-slate-700 rounded-lg p-3"
              >
                <span className="text-xs text-slate-500 font-mono w-6 text-center shrink-0">
                  {index + 1}
                </span>
                <p className="flex-1 text-sm text-white truncate">
                  {propertyTitles[url] || url}
                </p>
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => moveProperty(index, "up")}
                    disabled={index === 0}
                    className="h-8 w-8 p-0 text-slate-400 hover:text-white hover:bg-slate-700 disabled:opacity-30"
                    aria-label="上に移動"
                  >
                    <ChevronUp className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => moveProperty(index, "down")}
                    disabled={index === selectedUrls.length - 1}
                    className="h-8 w-8 p-0 text-slate-400 hover:text-white hover:bg-slate-700 disabled:opacity-30"
                    aria-label="下に移動"
                  >
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeProperty(url)}
                    className="h-8 w-8 p-0 text-red-400 hover:text-red-300 hover:bg-red-900/30"
                    aria-label="削除"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Notes */}
      <Card className="bg-slate-900/80 border-slate-800 backdrop-blur-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-white flex items-center gap-2 text-base">
            <StickyNote className="h-4 w-4 text-emerald-400" />
            備考
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="お客様へのメッセージや物件に関する補足事項を記入..."
            rows={4}
            className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 focus:border-emerald-500 resize-none"
          />

          {/* Market data toggle */}
          <div
            className="flex items-center gap-3 cursor-pointer"
            onClick={() => setIncludeMarketData(!includeMarketData)}
          >
            <Checkbox
              checked={includeMarketData}
              onCheckedChange={(checked) =>
                setIncludeMarketData(checked === true)
              }
              className={
                includeMarketData
                  ? "border-emerald-500 bg-emerald-600 data-[state=checked]:bg-emerald-600 data-[state=checked]:border-emerald-500"
                  : "border-slate-600"
              }
              aria-label="相場データを含める"
            />
            <div className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-slate-400" />
              <span className="text-sm text-slate-300">
                相場データを含める
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex items-center justify-between gap-3">
        <Button
          variant="outline"
          onClick={handleClearDraft}
          className="bg-slate-800/50 border-slate-700 text-slate-400 hover:bg-red-900/30 hover:text-red-300 hover:border-red-800"
        >
          <X className="h-4 w-4 mr-1" /> 下書きクリア
        </Button>
        <Button
          onClick={handlePreview}
          disabled={!canPreview}
          className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-lg shadow-emerald-900/30 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50 disabled:cursor-not-allowed px-6 min-h-[44px]"
        >
          <Eye className="h-4 w-4 mr-2" /> プレビュー
        </Button>
      </div>
    </div>
  );
}
