import { NextRequest, NextResponse } from "next/server";
import { predictSpike } from "@/lib/deriv";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const type = (req.nextUrl.searchParams.get("type") || "BOOM") as "BOOM" | "CRASH";
  const num = parseInt(req.nextUrl.searchParams.get("number") || "500");

  const prediction = predictSpike(type, num);

  return NextResponse.json({ prediction });
}
