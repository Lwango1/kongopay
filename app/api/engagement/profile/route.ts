import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/firebase";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000/api";

export async function GET() {
  const user = auth.currentUser;
  if (!user) return NextResponse.json({ error: "Non connecté" }, { status: 401 });

  const token = await user.getIdToken();
  const res = await fetch(`${API_BASE}/engagement/profile`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
