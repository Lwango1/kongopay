import { NextResponse } from "next/server";
import { getDerivState, connectDerivWebSocket } from "@/lib/deriv";

export const dynamic = "force-dynamic";

let connected = false;

export async function GET() {
  if (!connected) {
    connectDerivWebSocket();
    connected = true;
  }
  const data = getDerivState();
  return NextResponse.json(data);
}
