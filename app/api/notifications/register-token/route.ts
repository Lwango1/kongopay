import { NextRequest, NextResponse } from "next/server";

const IS_DEV = process.env.NODE_ENV === "development";
const BACKEND_URL = IS_DEV ? "http://localhost:3001/api" : (process.env.NEXT_PUBLIC_API_URL || "https://kongopay.onrender.com/api");

async function proxyToBackend(req: NextRequest, method: string) {
  try {
    const body = method === "POST" ? await req.json() : undefined;
    const authHeader = req.headers.get("authorization");

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (authHeader) headers["Authorization"] = authHeader;

    const res = await fetch(`${BACKEND_URL}/notifications/register-token`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    const data = await res.json().catch(() => ({}));
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ error: "Service indisponible" }, { status: 503 });
  }
}

export async function POST(req: NextRequest) {
  return proxyToBackend(req, "POST");
}

export async function DELETE(req: NextRequest) {
  return proxyToBackend(req, "DELETE");
}
