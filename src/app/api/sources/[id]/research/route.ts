import { NextResponse } from "next/server";
import {
  getSource,
  saveResearchResult,
  updateSourceStatus,
} from "@/lib/db";
import { GEMINI_MODEL, researchSource } from "@/lib/gemini";

export const runtime = "nodejs";
export const maxDuration = 300;

type Params = { params: Promise<{ id: string }> };

export async function POST(_request: Request, { params }: Params) {
  const { id } = await params;
  const sourceId = Number(id);
  if (!Number.isFinite(sourceId)) {
    return NextResponse.json({ error: "Invalid source id." }, { status: 400 });
  }

  const source = getSource(sourceId);
  if (!source) {
    return NextResponse.json({ error: "Source not found." }, { status: 404 });
  }

  if (!source.transcript.trim()) {
    return NextResponse.json(
      { error: "Source has no transcript to research." },
      { status: 400 },
    );
  }

  updateSourceStatus(sourceId, "researching");

  try {
    const result = await researchSource({
      title: source.title,
      url: source.url,
      showHost: source.show_host,
      notes: source.notes,
      transcript: source.transcript,
    });

    saveResearchResult(sourceId, GEMINI_MODEL, result);

    return NextResponse.json({
      ok: true,
      model: GEMINI_MODEL,
      ticker_count: result.tickers.length,
      second_order_count: result.tickers.filter(
        (ticker) => ticker.mention_type === "second_order",
      ).length,
      theme_count: result.themes.length,
      quality_notes: result.quality_notes,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Research failed.";
    updateSourceStatus(sourceId, "error", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
