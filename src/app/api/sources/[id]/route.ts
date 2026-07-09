import { NextResponse } from "next/server";
import { deleteSource, getSourceDetail } from "@/lib/db";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { id } = await params;
  const sourceId = Number(id);
  if (!Number.isFinite(sourceId)) {
    return NextResponse.json({ error: "Invalid source id." }, { status: 400 });
  }

  const detail = getSourceDetail(sourceId);
  if (!detail) {
    return NextResponse.json({ error: "Source not found." }, { status: 404 });
  }

  return NextResponse.json(detail);
}

export async function DELETE(_request: Request, { params }: Params) {
  const { id } = await params;
  const sourceId = Number(id);
  if (!Number.isFinite(sourceId)) {
    return NextResponse.json({ error: "Invalid source id." }, { status: 400 });
  }

  const detail = getSourceDetail(sourceId);
  if (!detail) {
    return NextResponse.json({ error: "Source not found." }, { status: 404 });
  }

  deleteSource(sourceId);
  return NextResponse.json({ ok: true });
}
