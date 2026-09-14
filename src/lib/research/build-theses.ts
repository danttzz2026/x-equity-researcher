import { z } from "zod";
import { generateStructured } from "./model";
import type { ThesisDraft, Usage } from "./types";

export interface ClaimForSynthesis {
  uid: string;
  claim: string;
  quote: string;
  claimType: string;
  importance: number;
  valueChainLayers: string[];
}

const schema = z.object({
  theses: z.array(z.object({
    title: z.string().min(8),
    summary: z.string().min(60),
    technicalMechanism: z.string().nullable(),
    valueChainLayers: z.array(z.string()).min(1).max(10),
    magnitudeClaim: z.string().nullable(),
    catalysts: z.array(z.string()).max(6),
    risks: z.array(z.string()).max(6),
    confidence: z.enum(["high", "medium", "speculative"]),
    // Deliberately unconstrained: thin theses are filtered below, after invalid
    // uids are stripped. Enforcing a minimum here would reject the whole batch.
    claimUids: z.array(z.string()).max(20),
  })).min(1).max(6),
});

const jsonSchema = {
  type: "object",
  properties: {
    theses: { type: "array", items: { type: "object", properties: {
      title: { type: "string" }, summary: { type: "string" }, technicalMechanism: { type: ["string", "null"] },
      valueChainLayers: { type: "array", items: { type: "string" } }, magnitudeClaim: { type: ["string", "null"] },
      catalysts: { type: "array", items: { type: "string" } }, risks: { type: "array", items: { type: "string" } },
      confidence: { type: "string", enum: ["high", "medium", "speculative"] }, claimUids: { type: "array", items: { type: "string" } },
    }, required: ["title", "summary", "technicalMechanism", "valueChainLayers", "magnitudeClaim", "catalysts", "risks", "confidence", "claimUids"] } },
  }, required: ["theses"],
};

export async function buildTheses(claims: ClaimForSynthesis[]): Promise<{ theses: ThesisDraft[]; usage: Usage }> {
  const response = await generateStructured({
    schema,
    jsonSchema,
    maxOutputTokens: 7_000,
    // Clustering an evidence ledger is the most reasoning-heavy stage.
    thinkingBudget: 6_000,
    prompt: `You are a public-equity research analyst. Cluster this evidence ledger into at most 6 differentiated, causal investment theses. Let the evidence determine the count; a single well-supported thesis is enough. A thesis must describe an economic mechanism, its technical driver, the value-chain bottleneck, and what would falsify it. Each thesis must cite at least 2 distinct claimUids. Do not split one thesis to increase the count. Do not force an AI-infrastructure template: use the transcript's actual subject. Do not name equities yet. Every thesis must cite only the supplied claimUids. Avoid duplicate theses and generic trends.\n\nEvidence ledger:\n${JSON.stringify(claims)}`,
  });
  const valid = new Set(claims.map((claim) => claim.uid));
  const theses = response.data.theses
    .map((thesis) => ({ ...thesis, claimUids: [...new Set(thesis.claimUids)].filter((uid) => valid.has(uid)) }))
    .filter((thesis) => thesis.claimUids.length >= 2);
  if (!theses.length) {
    throw new Error(`Thesis synthesis did not link enough transcript claims (${claims.length} claims available). Re-run extraction before retrying.`);
  }
  return { theses, usage: response.usage };
}

