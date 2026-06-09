import { NextRequest, NextResponse } from "next/server";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000/api";

export async function GET(req: NextRequest) {
  const limit = req.nextUrl.searchParams.get("limit") || "20";
  const res = await fetch(`${API_BASE}/signals/recent?limit=${limit}`);
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
