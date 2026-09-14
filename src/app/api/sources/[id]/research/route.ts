import { NextResponse } from "next/server";
import { createResearchRun, retryResearchRun, getSource, getActiveResearchRun } from "@/lib/db";
import { chunkTranscript } from "@/lib/research/chunk-transcript";
import { hasResearchApiKey, RESEARCH_MODEL } from "@/lib/research/model";

export const runtime = "nodejs";
export const maxDuration = 30;
type Params = { params: Promise<{ id: string }> };

export async function POST(_request: Request, { params }: Params) {
  const { id } = await params; const sourceId = Number(id);
  if (!Number.isFinite(sourceId)) return NextResponse.json({ error: "Invalid source id." }, { status: 400 });
  const source = getSource(sourceId);
  if (!source) return NextResponse.json({ error: "Source not found." }, { status: 404 });
  if (!source.transcript.trim()) return NextResponse.json({ error: "Source has no transcript to research." }, { status: 400 });
  if (!hasResearchApiKey()) return NextResponse.json({ error: "GEMINI_API_KEY is missing. Add it to .env.local and restart the server." }, { status: 400 });
  const existing = getActiveResearchRun(sourceId);
  if (existing) {
    if (existing.status === "error") retryResearchRun(existing.id);
    return NextResponse.json({ run_id: existing.id, resumed: true, model: existing.model }, { status: 202 });
  }
  const segments = chunkTranscript(source.transcript);
  if (!segments.length) return NextResponse.json({ error: "Transcript has no researchable text." }, { status: 400 });
  const run = createResearchRun(sourceId, RESEARCH_MODEL, segments);
  return NextResponse.json({ run_id: run.id, model: run.model, segment_count: run.segment_total, status_url: `/api/research-runs/${run.id}`, advance_url: `/api/research-runs/${run.id}/advance` }, { status: 202 });
}
