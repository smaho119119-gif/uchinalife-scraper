import { NextResponse } from "next/server";
import { supabase } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const urlsParam = searchParams.get("urls");

    if (!urlsParam) {
      return NextResponse.json(
        { error: "urls parameter is required" },
        { status: 400 }
      );
    }

    const urls = urlsParam.split(",").map((u) => decodeURIComponent(u.trim()));

    if (urls.length === 0) {
      return NextResponse.json([]);
    }

    if (urls.length > 20) {
      return NextResponse.json(
        { error: "Maximum 20 properties per request" },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("properties")
      .select("*")
      .in("url", urls);

    if (error) {
      console.error("Error fetching proposal properties:", error);
      return NextResponse.json(
        { error: "Failed to fetch properties" },
        { status: 500 }
      );
    }

    const properties = (data || []).map((row) => ({
      ...row,
      images:
        typeof row.images === "string" ? JSON.parse(row.images) : row.images,
      property_data:
        typeof row.property_data === "string"
          ? JSON.parse(row.property_data)
          : row.property_data,
      is_active: Boolean(row.is_active),
    }));

    // Preserve the order from the input URLs
    const ordered = urls
      .map((url) => properties.find((p) => p.url === url))
      .filter(Boolean);

    return NextResponse.json(ordered);
  } catch (error) {
    console.error("Proposal API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
