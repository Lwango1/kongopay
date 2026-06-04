import { NextResponse } from "next/server";
import { getDerivState } from "@/lib/deriv";

export const dynamic = "force-dynamic";

export async function GET() {
  const data = getDerivState();
  return NextResponse.json(data);
}
