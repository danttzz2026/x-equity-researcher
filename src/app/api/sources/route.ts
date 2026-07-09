import { NextResponse } from "next/server";
import { createSource, listSources } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  const sources = listSources();
  return NextResponse.json(sources);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const title = typeof body.title === "string" ? body.title.trim() : "";
    const url = typeof body.url === "string" ? body.url.trim() : "";
    const transcript =
      typeof body.transcript === "string" ? body.transcript.trim() : "";

    if (!title || !url || !transcript) {
      return NextResponse.json(
        { error: "Title, URL, and transcript are required." },
        { status: 400 },
      );
    }

    const source = createSource({
      title,
      url,
      show_host: typeof body.show_host === "string" ? body.show_host : undefined,
      notes: typeof body.notes === "string" ? body.notes : undefined,
      transcript,
    });

    return NextResponse.json(source, { status: 201 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to create source.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
