import { z } from "zod";
import { generateStructured } from "./model";
import type { ThesisDraft, Usage } from "./types";

const schema = z.object({ bodyMarkdown: z.string().trim().min(1) });
const jsonSchema = { type: "object", properties: { bodyMarkdown: { type: "string" } }, required: ["bodyMarkdown"] };

export async function writeThesisSection(input: { thesis: ThesisDraft; claims: Array<{ uid: string; claim: string; quote: string }>; sources: Array<{ url: string; title: string | null; snippet: string | null }>; equities: Array<{ symbol: string; companyName: string; rationale: string }> }): Promise<{ bodyMarkdown: string; usage: Usage }> {
  const response = await generateStructured({
    schema, jsonSchema, maxOutputTokens: 7_000,
    prompt: `Write a research chapter for this thesis, using only as much detail as the evidence supports. Cover the technical mechanism, market structure, value chain, investable implications, counter-thesis, and what to monitor where supported. Use only the supplied transcript claims and web sources; state evidence gaps explicitly. Cite transcript evidence inline as [Transcript: claim UID] and web evidence with Markdown URLs. Be specific and analytical; avoid repetition and padding.\n\nThesis:\n${JSON.stringify(input.thesis)}\n\nClaims:\n${JSON.stringify(input.claims)}\n\nWeb sources:\n${JSON.stringify(input.sources)}\n\nEquity mapping:\n${JSON.stringify(input.equities)}`,
  });
  return { bodyMarkdown: response.data.bodyMarkdown, usage: response.usage };
}
