import { NextResponse } from "next/server";
import { scanAllMarkets, connectDerivWebSocket } from "@/lib/deriv";

export const dynamic = "force-dynamic";

let connected = false;

export async function GET() {
  if (!connected) {
    connectDerivWebSocket();
    connected = true;
  }
  const result = scanAllMarkets();
  return NextResponse.json(result);
}
