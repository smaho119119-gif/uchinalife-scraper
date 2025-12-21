"use client";

import { usePathname } from "next/navigation";

export function Footer() {
    const pathname = usePathname();
    if (pathname === "/login") return null;

    return (
        <footer className="fixed bottom-0 right-0 left-0 md:left-64 h-12 bg-slate-900 border-t border-slate-800 z-40 px-6 flex items-center justify-between text-xs text-slate-500">
            <div>
                &copy; 2025 Uchina Life Scraper. All rights reserved.
            </div>
            <div className="flex space-x-4">
                <span className="hover:text-slate-300 cursor-pointer">プライバシーポリシー</span>
                <span className="hover:text-slate-300 cursor-pointer">利用規約</span>
            </div>
        </footer>
    );
}
