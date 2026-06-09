import { NextRequest, NextResponse } from "next/server";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000/api";
const BOT_USERNAME = process.env.NEXT_PUBLIC_TELEGRAM_BOT || "";

export async function GET() {
  if (!BOT_USERNAME) {
    return NextResponse.json({ error: "Bot non configuré" }, { status: 503 });
  }
  return NextResponse.json({
    botUsername: BOT_USERNAME,
    inviteUrl: `https://t.me/${BOT_USERNAME}`,
  });
}
