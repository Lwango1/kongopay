import { NextRequest, NextResponse } from "next/server";
import { predictNextTick } from "@/lib/deriv";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const type = (req.nextUrl.searchParams.get("type") || "BOOM") as "BOOM" | "CRASH";
  const num = parseInt(req.nextUrl.searchParams.get("number") || "500");
  const data = predictNextTick(type, num);
  return NextResponse.json(data);
}
