import { NextResponse } from "next/server";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "https://kongopay.onrender.com/api";

export async function GET() {
  const res = await fetch(`${API_BASE}/engagement/leaderboard?limit=20`);
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
