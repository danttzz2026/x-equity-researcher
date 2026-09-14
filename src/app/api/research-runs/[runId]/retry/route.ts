import { NextResponse } from "next/server";
import { retryResearchRun } from "@/lib/db";

export const runtime = "nodejs";
type Params = { params: Promise<{ runId: string }> };

export async function POST(_request: Request, { params }: Params) {
  const { runId } = await params; const run = retryResearchRun(Number(runId));
  return run ? NextResponse.json(run) : NextResponse.json({ error: "Research run not found or not retryable." }, { status: 404 });
}
