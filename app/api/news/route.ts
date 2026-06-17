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

    // Fallback: Financial Modeling Prep API (si clé configurée)
    const fmpKey = process.env.FMP_API_KEY;
    if (fmpKey) {
      try {
        const today = new Date().toISOString().split("T")[0];
        const nextWeek = new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0];
        const fmpRes = await fetch(
          `https://financialmodelingprep.com/api/v3/economic-calendar?from=${today}&to=${nextWeek}&apikey=${fmpKey}`
        );
        if (fmpRes.ok) {
          const json = await fmpRes.json();
          const events = (json || [])
            .filter((e: any) => e.event && e.country)
            .map((e: any) => ({
              id: `FMP-${e.date}-${((e.event || "").slice(0, 10)).replace(/\s/g, "-")}`,
              date: (e.date || "").split(" ")[0] || today,
              time: e.time || "12:00",
              title: `${e.country} — ${e.event}`,
              country: (e.country || "").slice(0, 2).toUpperCase(),
              currency: e.currency || "",
              impact: e.impact?.toLowerCase() === "high" || e.importance === "high" ? "high" : e.impact?.toLowerCase() === "medium" || e.importance === "medium" ? "medium" : "low",
              previous: e.previous ?? "",
              forecast: e.forecast ?? "",
              actual: e.actual ?? null,
              status: e.actual ? "done" : "upcoming",
              sentiment: null,
              confidence: 0,
            }));
          return NextResponse.json({ events, signals: [], marketContext: { trend: "ranging", volatility: "medium" }, source: "fmp-api", timestamp: Date.now() });
        }
      } catch {}
    }

    // Fallback: génération locale
    const data = getNewsData();
    return NextResponse.json({
      events: data.events,
      signals: data.signals,
      marketContext: data.marketContext,
      activeTrades: [],
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
