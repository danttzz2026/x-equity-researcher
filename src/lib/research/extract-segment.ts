import { z } from "zod";
import { generateStructured } from "./model";
import type { ExtractedSegment, SegmentInput, Usage } from "./types";

const claimSchema = z.object({
  claim: z.string().min(8),
  claimType: z.enum(["technical", "magnitude", "causal", "bottleneck", "market_structure"]),
  importance: z.number().int().min(1).max(5),
  confidence: z.enum(["high", "medium", "speculative"]),
  quote: z.string().min(3),
  entities: z.array(z.string()).max(12),
  valueChainLayers: z.array(z.string()).max(8),
});

const schema = z.object({ claims: z.array(claimSchema).max(18) });

const jsonSchema = {
  type: "object",
  properties: {
    claims: {
      type: "array",
      items: {
        type: "object",
        properties: {
          claim: { type: "string" },
          claimType: { type: "string", enum: ["technical", "magnitude", "causal", "bottleneck", "market_structure"] },
          importance: { type: "integer", minimum: 1, maximum: 5 },
          confidence: { type: "string", enum: ["high", "medium", "speculative"] },
          quote: { type: "string" },
          entities: { type: "array", items: { type: "string" } },
          valueChainLayers: { type: "array", items: { type: "string" } },
        },
        required: ["claim", "claimType", "importance", "confidence", "quote", "entities", "valueChainLayers"],
      },
    },
  },
  required: ["claims"],
};

export async function extractSegment(segment: SegmentInput): Promise<{ data: ExtractedSegment; usage: Usage }> {
  const response = await generateStructured({
    schema,
    jsonSchema,
    maxOutputTokens: 4_096,
    prompt: `You are an evidence extraction engine for technical public-equity research. Process this ONE transcript segment only. Return atomic investable claims; do not synthesize a thesis and do not suggest tickers. Each quote MUST be an exact contiguous quote from the segment, 6-40 words. Prefer claims about mechanism, scaling law, bottleneck, unit economics, market power, supply chain, or measurable magnitude. Do not infer facts not said in the segment.\n\nSegment id: ${segment.uid}\nTranscript segment:\n---\n${segment.text}\n---`,
  });
  return { data: response.data, usage: response.usage };
}
