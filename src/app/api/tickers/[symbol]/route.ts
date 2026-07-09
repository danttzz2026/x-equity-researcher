import { NextResponse } from "next/server";
import { getTickerDetail } from "@/lib/db";

export const runtime = "nodejs";

type Params = { params: Promise<{ symbol: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { symbol } = await params;
  const detail = getTickerDetail(decodeURIComponent(symbol));
  if (!detail) {
    return NextResponse.json({ error: "Ticker not found." }, { status: 404 });
  }
  return NextResponse.json(detail);
}
