import { NextResponse } from "next/server";
import { GEMINI_MODEL, hasApiKey } from "@/lib/gemini";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({
    model: GEMINI_MODEL,
    api_key_configured: hasApiKey(),
  });
}
