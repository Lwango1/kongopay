import { NextResponse } from "next/server";
import { getNewsData } from "@/lib/newsData";

export const dynamic = "force-dynamic";
export const revalidate = 300;

export async function GET() {
  try {
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3001";

    // Try backend first
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 4000);
      const res = await fetch(`${backendUrl}/api/news`, {
        signal: controller.signal,
        headers: { "Accept": "application/json" },
      });
      clearTimeout(timeout);
      if (res.ok) {
        const data = await res.json();
        return NextResponse.json({ ...data, source: "backend" });
      }
    } catch {}

    // Fallback: génération locale
    const data = getNewsData();
    return NextResponse.json({
      events: data.events,
      signals: data.signals,
      marketContext: data.marketContext,
      source: "local",
      timestamp: Date.now(),
    });
  } catch (err) {
    return NextResponse.json(
      { error: "Erreur calendrier", events: [], signals: [], source: "error" },
      { status: 500 }
    );
  }
}
