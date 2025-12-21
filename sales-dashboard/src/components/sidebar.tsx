import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { LayoutDashboard, Building2, Calendar, Settings, LogOut, Map, Shield, BarChart3 } from "lucide-react";
import { signOut } from "next-auth/react";

export function Sidebar() {
    const pathname = usePathname();

    return (
        <div className="fixed left-0 top-0 bottom-0 w-64 bg-slate-900 border-r border-slate-800 z-50 hidden md:flex flex-col">
            <div className="flex-1 space-y-4 py-4">
                <div className="px-3 py-2">
                    <h2 className="mb-2 px-4 text-lg font-semibold tracking-tight text-white flex items-center">
                        <Building2 className="mr-2 h-6 w-6 text-emerald-500" />
                        営業ダッシュボード
                    </h2>
                    <div className="space-y-1 mt-8">
                        <Link href="/">
                            <Button
                                variant="ghost"
                                className={`w-full justify-start ${pathname === "/" ? "bg-emerald-600 text-white hover:bg-emerald-700" : "text-slate-200"}`}
                            >
                                <LayoutDashboard className="mr-2 h-4 w-4" />
                                ダッシュボード
                            </Button>
                        </Link>
                        <Link href="/properties">
                            <Button
                                variant="ghost"
                                className={`w-full justify-start ${pathname === "/properties" ? "bg-emerald-600 text-white hover:bg-emerald-700" : "text-slate-200"}`}
                            >
                                <Building2 className="mr-2 h-4 w-4" />
                                物件一覧
                            </Button>
                        </Link>
                        <Link href="/map">
                            <Button
                                variant="ghost"
                                className={`w-full justify-start ${pathname === "/map" ? "bg-emerald-600 text-white hover:bg-emerald-700" : "text-slate-200"}`}
                            >
                                <Map className="mr-2 h-4 w-4" />
                                物件マップ
                            </Button>
                        </Link>
                        <Link href="/analytics">
                            <Button
                                variant="ghost"
                                className={`w-full justify-start ${pathname === "/analytics" ? "bg-emerald-600 text-white hover:bg-emerald-700" : "text-slate-200"}`}
                            >
                                <BarChart3 className="mr-2 h-4 w-4" />
                                差分分析
                            </Button>
                        </Link>
                        <Link href="/admin">
                            <Button
                                variant="ghost"
                                className={`w-full justify-start ${pathname === "/admin" ? "bg-emerald-600 text-white hover:bg-emerald-700" : "text-slate-200"}`}
                            >
                                <Shield className="mr-2 h-4 w-4" />
                                管理ページ
                            </Button>
                        </Link>
                        <Button variant="ghost" className="w-full justify-start text-slate-200 cursor-not-allowed opacity-50">
                            <Calendar className="mr-2 h-4 w-4" />
                            カレンダー
                        </Button>
                        <Button variant="ghost" className="w-full justify-start text-slate-200 cursor-not-allowed opacity-50">
                            <Settings className="mr-2 h-4 w-4" />
                            設定
                        </Button>
                    </div>
                </div>
            </div>
            <div className="p-4 border-t border-slate-800">
                <Button
                    variant="ghost"
                    className="w-full justify-start text-red-400 hover:text-red-300 hover:bg-red-900/20"
                    onClick={() => signOut()}
                >
                    <LogOut className="mr-2 h-4 w-4" />
                    ログアウト
                </Button>
            </div>
        </div>
    );
}
