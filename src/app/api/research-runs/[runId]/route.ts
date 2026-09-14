import { NextResponse } from "next/server";
import { getResearchRunStatus } from "@/lib/db";

export const runtime = "nodejs";
type Params = { params: Promise<{ runId: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { runId } = await params; const run = getResearchRunStatus(Number(runId));
  return run ? NextResponse.json(run) : NextResponse.json({ error: "Research run not found." }, { status: 404 });
}
