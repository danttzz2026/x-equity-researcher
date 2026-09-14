import { NextResponse } from "next/server";
import { RESEARCH_MODEL, hasResearchApiKey } from "@/lib/research/model";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({
    model: RESEARCH_MODEL,
    api_key_configured: hasResearchApiKey(),
  });
}
