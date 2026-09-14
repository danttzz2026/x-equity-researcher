import { z } from "zod";
import { generateStructured } from "./model";
import type { EquityDraft, ThesisDraft, Usage } from "./types";

const anchors = ["NVDA", "MSFT", "GOOGL", "GOOG", "AMZN", "META", "TSM", "TSMC", "AVGO"];
const schema = z.object({
  equities: z.array(z.object({
    symbol: z.string().min(1), companyName: z.string().min(2), exchange: z.string().nullable(), country: z.string().nullable(),
    confidence: z.enum(["high", "medium", "speculative"]), mentionType: z.enum(["explicit", "second_order", "related"]), valueChainLayer: z.string().nullable(), timeHorizon: z.string().nullable(),
    exposureScore: z.number().int().min(1).max(5), purityScore: z.number().int().min(1).max(5), asymmetryScore: z.number().int().min(1).max(5), rationale: z.string().min(50),
    catalysts: z.array(z.string()).max(5), risks: z.array(z.string()).max(5), falsifiers: z.array(z.string()).max(5), valuationQuestions: z.array(z.string()).max(5),
    claimUids: z.array(z.string()).min(1), webSourceUrls: z.array(z.string()).min(1),
  })).max(10),
});
const jsonSchema = { type: "object", properties: {
  equities: { type: "array", items: { type: "object", properties: {
    symbol: { type: "string" }, companyName: { type: "string" }, exchange: { type: ["string", "null"] }, country: { type: ["string", "null"] }, confidence: { type: "string", enum: ["high", "medium", "speculative"] }, mentionType: { type: "string", enum: ["explicit", "second_order", "related"] }, valueChainLayer: { type: ["string", "null"] }, timeHorizon: { type: ["string", "null"] }, exposureScore: { type: "integer", minimum: 1, maximum: 5 }, purityScore: { type: "integer", minimum: 1, maximum: 5 }, asymmetryScore: { type: "integer", minimum: 1, maximum: 5 }, rationale: { type: "string" }, catalysts: { type: "array", items: { type: "string" } }, risks: { type: "array", items: { type: "string" } }, falsifiers: { type: "array", items: { type: "string" } }, valuationQuestions: { type: "array", items: { type: "string" } }, claimUids: { type: "array", items: { type: "string" } }, webSourceUrls: { type: "array", items: { type: "string" } },
  }, required: ["symbol", "companyName", "exchange", "country", "confidence", "mentionType", "valueChainLayer", "timeHorizon", "exposureScore", "purityScore", "asymmetryScore", "rationale", "catalysts", "risks", "falsifiers", "valuationQuestions", "claimUids", "webSourceUrls"] } },
}, required: ["equities"] };

export async function mapEquities(input: { thesis: ThesisDraft; claims: Array<{ uid: string; claim: string; quote: string }>; webSources: Array<{ url: string; title: string | null; snippet: string | null }> }): Promise<{ equities: EquityDraft[]; usage: Usage }> {
  const response = await generateStructured({
    schema,
    jsonSchema,
    maxOutputTokens: 7_000,
    prompt: `Map this thesis to at most 10 evidence-supported public-equity expressions. Return fewer, including an empty array, when the evidence does not support investable companies. Prefer second-order suppliers, bottleneck owners, and underappreciated beneficiaries. The obvious anchors ${anchors.join(", ")} may appear only if the thesis-specific expression is unusually differentiated; they should be a minority. Every company MUST link to at least one exact transcript claim UID AND at least one supplied verified web URL. Scores are 1-5 for exposure, purity, and asymmetric upside. Explain catalysts, risks, falsifiers, and the valuation questions an analyst must answer. Do not fabricate ticker listings.\n\nThesis:\n${JSON.stringify(input.thesis)}\n\nGrounded claims:\n${JSON.stringify(input.claims)}\n\nVerified web sources:\n${JSON.stringify(input.webSources)}`,
  });
  const validClaims = new Set(input.claims.map((claim) => claim.uid));
  const validUrls = new Set(input.webSources.map((source) => source.url));
  const equities = response.data.equities.filter((equity) => equity.claimUids.some((uid) => validClaims.has(uid)) && equity.webSourceUrls.some((url) => validUrls.has(url)));
  return { equities, usage: response.usage };
}
