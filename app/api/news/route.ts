import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 300;

const IS_DEV = process.env.NODE_ENV === "development";
const DEV_API = "http://localhost:3001/api";
const PROD_API = "https://kongopay.onrender.com/api";

export async function GET() {
  const backendUrl = IS_DEV ? DEV_API : (process.env.NEXT_PUBLIC_API_URL || PROD_API);

  try {
    const res = await fetch(`${backendUrl}/news`, {
      next: { revalidate: 300 },
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: "Service calendrier économique indisponible", events: [], signals: [], source: "error" },
        { status: 502 }
      );
    }

    const data = await res.json();
    if (!data.events || data.events.length === 0) {
      return NextResponse.json(
        { error: "Aucun événement trouvé", events: [], signals: [], source: "empty" },
        { status: 404 }
      );
    }

    return NextResponse.json(data);
  } catch {
    return NextResponse.json(
      { error: "Erreur de connexion au backend", events: [], signals: [], source: "error" },
      { status: 502 }
    );
  }
}
