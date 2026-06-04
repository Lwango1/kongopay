import { NextRequest, NextResponse } from "next/server";
import { predictNextTick } from "@/lib/deriv";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const type = (req.nextUrl.searchParams.get("type") || "boom") as "boom" | "crash";
  const data = predictNextTick(type);
  return NextResponse.json(data);
}
