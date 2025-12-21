"use client";

import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/sidebar";

export default function SidebarWrapper() {
    const pathname = usePathname();
    // Don't show sidebar on login page
    if (pathname === "/login") return null;

    return <Sidebar />;
}
