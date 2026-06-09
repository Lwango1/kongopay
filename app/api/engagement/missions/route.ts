import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/firebase";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "https://kongopay.onrender.com/api";

export async function GET() {
  const user = auth.currentUser;
  if (!user) return NextResponse.json({ error: "Non connecté" }, { status: 401 });

  const token = await user.getIdToken();
  const res = await fetch(`${API_BASE}/engagement/missions`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
