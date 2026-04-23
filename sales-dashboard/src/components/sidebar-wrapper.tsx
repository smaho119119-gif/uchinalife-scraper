'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Menu } from 'lucide-react';
import { Sidebar } from '@/components/sidebar';

export default function SidebarWrapper() {
    const pathname = usePathname();
    const [open, setOpen] = useState(false);

    useEffect(() => {
        setOpen(false);
    }, [pathname]);

    if (pathname === '/login') return null;

    return (
        <>
            <button
                type="button"
                onClick={() => setOpen(true)}
                className="fixed top-3 left-3 z-30 md:hidden inline-flex items-center justify-center rounded-md bg-slate-900/90 backdrop-blur p-2 text-slate-100 shadow-lg border border-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                aria-label="メニューを開く"
                aria-expanded={open}
            >
                <Menu className="h-5 w-5" />
            </button>

            <Sidebar open={open} onClose={() => setOpen(false)} />
        </>
    );
}
