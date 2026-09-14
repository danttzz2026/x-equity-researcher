import { NextResponse } from "next/server";
import { advanceResearchRun } from "@/lib/research/pipeline";

export const runtime = "nodejs";
export const maxDuration = 60;
type Params = { params: Promise<{ runId: string }> };

export async function POST(_request: Request, { params }: Params) {
  const { runId } = await params; const id = Number(runId);
  if (!Number.isFinite(id)) return NextResponse.json({ error: "Invalid research run id." }, { status: 400 });
  try { return NextResponse.json(await advanceResearchRun(id)); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Could not advance research." }, { status: 500 }); }
}
