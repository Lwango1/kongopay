import { NextRequest, NextResponse } from "next/server";
import { getTicker, getAllTickers } from "@/lib/binance";

export async function GET(req: NextRequest) {
  try {
    const symbol = req.nextUrl.searchParams.get("symbol");
    if (symbol) {
      const data = await getTicker(symbol);
      return NextResponse.json(data);
    }
    const data = await getAllTickers();
    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
