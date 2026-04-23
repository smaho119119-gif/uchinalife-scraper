'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
    LayoutDashboard,
    Building2,
    Calendar,
    Settings,
    LogOut,
    Map,
    Shield,
    BarChart3,
    CircleDollarSign,
    Sparkles,
    FileText,
    MapPinned,
    X,
} from 'lucide-react';
import { signOut } from 'next-auth/react';

interface SidebarProps {
    /** When true on mobile, the drawer slides in from the left. */
    open?: boolean;
    /** Called when the user requests to close the drawer (overlay click, link click). */
    onClose?: () => void;
}

export function Sidebar({ open = false, onClose }: SidebarProps) {
    const pathname = usePathname();

    const navClass = (path: string) =>
        `w-full justify-start border-0 shadow-none hover:scale-100 ${
            pathname === path
                ? 'bg-emerald-600 text-white hover:bg-emerald-700 hover:text-white'
                : 'text-slate-200 hover:bg-slate-800 hover:text-white'
        }`;

    const disabledClass =
        'w-full justify-start text-slate-200 cursor-not-allowed opacity-50 border-0 shadow-none hover:scale-100';

    return (
        <>
            {open && (
                <div
                    className="fixed inset-0 z-40 bg-black/60 md:hidden"
                    onClick={onClose}
                    aria-hidden="true"
                />
            )}
            <aside
                className={`fixed left-0 top-0 bottom-0 w-64 bg-slate-900 border-r border-slate-800 z-50 flex flex-col transform transition-transform duration-200 ease-out
                    ${open ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0`}
                aria-label="主要ナビゲーション"
            >
                <div className="flex-1 space-y-4 py-4 overflow-y-auto">
                    <div className="px-3 py-2">
                        <div className="mb-2 px-4 flex items-center justify-between">
                            <h2 className="text-lg font-semibold tracking-tight text-white flex items-center">
                                <Building2 className="mr-2 h-6 w-6 text-emerald-500" />
                                営業ダッシュボード
                            </h2>
                            <button
                                type="button"
                                onClick={onClose}
                                className="md:hidden text-slate-300 hover:text-white p-1 rounded focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                aria-label="メニューを閉じる"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>
                        <div className="space-y-1 mt-8" onClick={onClose}>
                            <Link href="/">
                                <Button variant="ghost" className={navClass('/')}>
                                    <LayoutDashboard className="mr-2 h-4 w-4" />
                                    ダッシュボード
                                </Button>
                            </Link>
                            <Link href="/properties">
                                <Button variant="ghost" className={navClass('/properties')}>
                                    <Building2 className="mr-2 h-4 w-4" />
                                    物件一覧
                                </Button>
                            </Link>
                            <Link href="/map">
                                <Button variant="ghost" className={navClass('/map')}>
                                    <Map className="mr-2 h-4 w-4" />
                                    物件マップ
                                </Button>
                            </Link>
                            <Link href="/analytics">
                                <Button variant="ghost" className={navClass('/analytics')}>
                                    <BarChart3 className="mr-2 h-4 w-4" />
                                    差分分析
                                </Button>
                            </Link>

                            <div className="pt-4 pb-2 px-4">
                                <div className="flex items-center gap-2">
                                    <div className="flex-1 h-px bg-slate-700" />
                                    <span className="text-xs font-medium text-slate-500 whitespace-nowrap">
                                        営業ツール
                                    </span>
                                    <div className="flex-1 h-px bg-slate-700" />
                                </div>
                            </div>

                            <Link href="/sales/market-price">
                                <Button variant="ghost" className={navClass('/sales/market-price')}>
                                    <CircleDollarSign className="mr-2 h-4 w-4" />
                                    相場価格
                                </Button>
                            </Link>
                            <Link href="/sales/featured">
                                <Button variant="ghost" className={navClass('/sales/featured')}>
                                    <Sparkles className="mr-2 h-4 w-4" />
                                    特集
                                </Button>
                            </Link>
                            <Link href="/sales/proposal">
                                <Button variant="ghost" className={navClass('/sales/proposal')}>
                                    <FileText className="mr-2 h-4 w-4" />
                                    物件提案
                                </Button>
                            </Link>
                            <Link href="/sales/area-analysis">
                                <Button variant="ghost" className={navClass('/sales/area-analysis')}>
                                    <MapPinned className="mr-2 h-4 w-4" />
                                    エリア分析
                                </Button>
                            </Link>

                            <Link href="/admin">
                                <Button variant="ghost" className={navClass('/admin')}>
                                    <Shield className="mr-2 h-4 w-4" />
                                    管理ページ
                                </Button>
                            </Link>
                            <Button variant="ghost" className={disabledClass} disabled>
                                <Calendar className="mr-2 h-4 w-4" />
                                カレンダー
                            </Button>
                            <Button variant="ghost" className={disabledClass} disabled>
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
            </aside>
        </>
    );
}
