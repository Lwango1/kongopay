import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 300;

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || "https://kongopay.onrender.com/api";

export async function GET() {
  try {
    const res = await fetch(`${BACKEND_URL}/news`, {
      next: { revalidate: 300 },
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: "Service calendrier économique indisponible", events: [], signals: [], source: "error" },
        { status: 502 }
      );
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json(
      { error: "Erreur de connexion au backend", events: [], signals: [], source: "error" },
      { status: 502 }
    );
  }
}
