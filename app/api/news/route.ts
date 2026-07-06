import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 30;

const IS_DEV = process.env.NODE_ENV === "development";
const BACKEND_URL = IS_DEV ? "http://localhost:3001/api" : (process.env.NEXT_PUBLIC_API_URL || "https://kongopay.onrender.com/api");

export async function GET() {
  try {
    const res = await fetch(`${BACKEND_URL}/forex-analysis`, {
      next: { revalidate: 30 },
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) {
      return NextResponse.json(
        { connected: false, pairs: [], signals: [], source: "error" },
        { status: 502 }
      );
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json(
      { connected: false, pairs: [], signals: [], source: "error" },
      { status: 502 }
    );
  }
}
