import { NextRequest, NextResponse } from "next/server";
import { getOrderBook } from "@/lib/binance";

export async function GET(req: NextRequest) {
  try {
    const symbol = req.nextUrl.searchParams.get("symbol") || "BTC/USDT";
    const limit = parseInt(req.nextUrl.searchParams.get("limit") || "20");
    const data = await getOrderBook(symbol, limit);
    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
