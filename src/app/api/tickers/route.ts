import { NextResponse } from "next/server";
import { listTickers } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json(listTickers());
}
