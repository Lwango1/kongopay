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

    // Fallback: Finnhub API (si clé configurée)
    const finnhubKey = process.env.FINNHUB_API_KEY;
    if (finnhubKey) {
      try {
        const fhRes = await fetch(`https://finnhub.io/api/v1/calendar/economic?token=${finnhubKey}`);
        if (fhRes.ok) {
          const json = await fhRes.json();
          const calendar: any[] = json.economicCalendar || [];
          const events = calendar
            .filter((e: any) => e.event)
            .map((e: any) => ({
              id: `FH-${((e.event || "").slice(0, 20)).replace(/\s/g, "-")}-${Math.random().toString(36).slice(2, 6)}`,
              date: (e.time || "").split(" ")[0] || new Date().toISOString().split("T")[0],
              time: (e.time || "").split(" ")[1]?.slice(0, 5) || "12:00",
              title: `${e.country || ""} — ${e.event}`,
              country: e.country || "",
              currency: e.currency || "",
              impact: e.impact === "high" || e.impact === "medium" || e.impact === "low" ? e.impact : "medium",
              previous: e.prev != null ? String(e.prev) : "",
              forecast: e.estimate != null ? String(e.estimate) : "",
              actual: e.actual != null ? String(e.actual) : null,
              status: e.actual != null ? "done" : "upcoming",
              sentiment: null,
              confidence: 0,
            }));
          return NextResponse.json({ events, signals: [], marketContext: { trend: "ranging", volatility: "medium" }, source: "finnhub-api", timestamp: Date.now() });
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
