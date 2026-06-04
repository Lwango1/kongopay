import { NextRequest, NextResponse } from "next/server";
import { getHistoricalRates } from "@/lib/binance";

export async function GET(req: NextRequest) {
  try {
    const symbol = req.nextUrl.searchParams.get("symbol") || "BTC/USDT";
    const timeframe = req.nextUrl.searchParams.get("timeframe") || "1h";
    const limit = parseInt(req.nextUrl.searchParams.get("limit") || "100");
    const data = await getHistoricalRates(symbol, timeframe, limit);
    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
