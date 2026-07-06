import { NextRequest, NextResponse } from "next/server";

const IS_DEV = process.env.NODE_ENV === "development";
const BACKEND_URL = IS_DEV ? "http://localhost:3001/api" : (process.env.NEXT_PUBLIC_API_URL || "https://kongopay.onrender.com/api");

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const { title, body, data } = await req.json();
    if (!title || !body) {
      return NextResponse.json({ error: "title et body requis" }, { status: 400 });
    }

    // Proxy vers le backend qui gère les tokens FCM
    try {
      const res = await fetch(`${BACKEND_URL}/notifications/send-signal`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: authHeader,
        },
        body: JSON.stringify({ title, body, data }),
      });
      const result = await res.json().catch(() => ({}));
      return NextResponse.json({ sent: res.ok, ...result }, { status: res.status });
    } catch {
      return NextResponse.json({ error: "Backend indisponible" }, { status: 503 });
    }
  } catch {
    return NextResponse.json({ error: "Erreur interne" }, { status: 500 });
  }
}
