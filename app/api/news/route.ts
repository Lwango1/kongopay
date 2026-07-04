import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 300;

export async function GET() {
  const finnhubKey = process.env.FINNHUB_API_KEY;

  if (!finnhubKey) {
    return NextResponse.json(
      { error: "Clé API Finnhub non configurée", events: [], signals: [], source: "unconfigured" },
      { status: 503 }
    );
  }

  try {
    const fhRes = await fetch(`https://finnhub.io/api/v1/calendar/economic?token=${finnhubKey}`, {
      next: { revalidate: 300 },
    });

    if (!fhRes.ok) {
      return NextResponse.json(
        { error: "Service Finnhub indisponible", events: [], signals: [], source: "error" },
        { status: 502 }
      );
    }

    const json = await fhRes.json();
    const calendar: any[] = json.economicCalendar || [];

    if (calendar.length === 0) {
      return NextResponse.json({
        events: [],
        signals: [],
        marketContext: { trend: "ranging", volatility: "medium" },
        source: "finnhub",
        timestamp: Date.now(),
      });
    }

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

    return NextResponse.json({
      events,
      signals: [],
      marketContext: { trend: "ranging", volatility: "medium" },
      source: "finnhub",
      timestamp: Date.now(),
    });
  } catch (err) {
    return NextResponse.json(
      { error: "Erreur de connexion à Finnhub", events: [], signals: [], source: "error" },
      { status: 502 }
    );
  }
}
