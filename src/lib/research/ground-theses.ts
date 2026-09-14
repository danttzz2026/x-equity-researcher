import { z } from "zod";
import { generateStructured } from "./model";
import type { GroundedSourceDraft, ThesisDraft, Usage } from "./types";

const sourceSchema = z.object({
  url: z.string().url(), title: z.string().nullable(), publisher: z.string().nullable(), snippet: z.string().nullable(),
  sourceType: z.string().nullable(), credibility: z.enum(["high", "medium", "speculative"]),
});
const schema = z.object({
  verification: z.string().min(40),
  sources: z.array(sourceSchema).max(10),
});
const jsonSchema = { type: "object", properties: {
  verification: { type: "string" },
  sources: { type: "array", items: { type: "object", properties: {
    url: { type: "string" }, title: { type: ["string", "null"] }, publisher: { type: ["string", "null"] }, snippet: { type: ["string", "null"] }, sourceType: { type: ["string", "null"] }, credibility: { type: "string", enum: ["high", "medium", "speculative"] },
  }, required: ["url", "title", "publisher", "snippet", "sourceType", "credibility"] } },
}, required: ["verification", "sources"] };

export async function groundThesis(input: { thesis: ThesisDraft; evidence: Array<{ uid: string; claim: string; quote: string }> }): Promise<{ verification: string; sources: GroundedSourceDraft[]; usage: Usage }> {
  const response = await generateStructured({
    schema,
    jsonSchema,
    useGoogleSearch: true,
    maxOutputTokens: 6_000,
    prompt: `Verify this transcript-derived investment thesis with current public web sources. Research market size or capacity where relevant, suppliers and competitors, public listings, and actual company exposure. Separate what the transcript says from what the web verifies. Use primary sources where possible (company filings, IR, government, standards bodies); downgrade weak sources. Return 3-8 distinct cited URLs and a concise verification note. Do not invent facts, citations, or tickers.\n\nKeep the response compact so it fits the output budget: the verification note must be under 200 words, and each snippet must be a single sentence under 40 words.\n\nThesis:\n${JSON.stringify(input.thesis)}\n\nTranscript evidence:\n${JSON.stringify(input.evidence)}`,
  });
  const sources = [...response.data.sources, ...response.sources].filter((source, index, all) => all.findIndex((item) => item.url === source.url) === index);
  return { verification: response.data.verification, sources, usage: response.usage };
}
