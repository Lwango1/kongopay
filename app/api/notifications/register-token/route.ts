import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api";

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
