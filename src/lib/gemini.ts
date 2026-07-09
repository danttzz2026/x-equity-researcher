import { GoogleGenerativeAI } from "@google/generative-ai";
import type { Confidence, MentionType, ResearchResult } from "./types";

/** Default: Gemini 3.5 Flash — current stable high-quality model. Override with GEMINI_MODEL. */
export const GEMINI_MODEL =
  process.env.GEMINI_MODEL?.trim() || "gemini-3.5-flash";

export function hasApiKey(): boolean {
  return Boolean(process.env.GEMINI_API_KEY?.trim());
}

function getClient() {
  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key) {
    throw new Error(
      "GEMINI_API_KEY is missing. Add it to .env.local and restart the server.",
    );
  }
  return new GoogleGenerativeAI(key);
}

const RESEARCH_SCHEMA_HINT = `{
  "summary": "4-7 sentence deep research brief: the speaker's non-obvious market theses, technical bottlenecks, and investable implications — not a generic episode recap",
  "themes": [
    {
      "name": "short theme name",
      "sector": "sector or null",
      "description": "technical detail from the source — bottlenecks, architectures, cost curves, constraints",
      "market_structure": "who captures value / competitive dynamics or null"
    }
  ],
  "market_theses": [
    {
      "name": "exploding or structurally important market (e.g. AI inference demand)",
      "magnitude_claim": "speaker's size/growth claim if any (e.g. bigger than oil) or null",
      "technical_driver": "the technical reason this market expands",
      "value_chain": "layers that benefit: e.g. power -> cooling -> networking -> accelerators -> memory -> software",
      "why_it_matters": "why an equity investor should care",
      "time_horizon": "near-term / medium / multi-year or null"
    }
  ],
  "claims": [
    {
      "claim": "specific technical or market claim from the speaker (quote-ish, precise)",
      "importance": "second-order investable implication"
    }
  ],
  "tickers": [
    {
      "symbol": "TICKER",
      "company_name": "Company Name",
      "confidence": "high|medium|speculative",
      "rationale": "2-4 sentences: which thesis this maps to, which value-chain layer, and WHY this name — not just that AI is big",
      "mention_type": "explicit|second_order|related",
      "themes": ["theme or thesis names"],
      "value_chain_layer": "e.g. inference accelerators, HBM, networking, power, cooling, foundry, EDA, software",
      "thesis_link": "name of the market_thesis this primarily expresses",
      "time_horizon": "near-term / medium / multi-year or null"
    }
  ]
}`;

function extractJson(text: string): unknown {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1].trim() : trimmed;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("Model response did not contain JSON.");
  }
  return JSON.parse(candidate.slice(start, end + 1));
}

function asNullableString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function normalizeMentionType(raw: string): MentionType {
  if (raw === "explicit" || raw === "second_order" || raw === "related") {
    return raw;
  }
  if (raw === "inferred" || raw === "exposure" || raw === "beneficiary") {
    return "second_order";
  }
  return "related";
}

function normalizeResult(raw: unknown): ResearchResult {
  if (!raw || typeof raw !== "object") {
    throw new Error("Invalid research payload.");
  }

  const data = raw as Record<string, unknown>;
  const themes = Array.isArray(data.themes) ? data.themes : [];
  const marketTheses = Array.isArray(data.market_theses)
    ? data.market_theses
    : [];
  const claims = Array.isArray(data.claims) ? data.claims : [];
  const tickers = Array.isArray(data.tickers) ? data.tickers : [];

  return {
    summary:
      typeof data.summary === "string" && data.summary.trim()
        ? data.summary.trim()
        : "No summary returned.",
    themes: themes
      .map((theme) => {
        const t = theme as Record<string, unknown>;
        if (typeof t.name !== "string" || typeof t.description !== "string") {
          return null;
        }
        return {
          name: t.name.trim(),
          sector: asNullableString(t.sector),
          description: t.description.trim(),
          market_structure: asNullableString(t.market_structure),
        };
      })
      .filter((t): t is NonNullable<typeof t> => Boolean(t)),
    market_theses: marketTheses
      .map((thesis) => {
        const t = thesis as Record<string, unknown>;
        if (
          typeof t.name !== "string" ||
          typeof t.why_it_matters !== "string"
        ) {
          return null;
        }
        return {
          name: t.name.trim(),
          magnitude_claim: asNullableString(t.magnitude_claim),
          technical_driver: asNullableString(t.technical_driver),
          value_chain: asNullableString(t.value_chain),
          why_it_matters: t.why_it_matters.trim(),
          time_horizon: asNullableString(t.time_horizon),
        };
      })
      .filter((t): t is NonNullable<typeof t> => Boolean(t)),
    claims: claims
      .map((claim) => {
        const c = claim as Record<string, unknown>;
        if (typeof c.claim !== "string") return null;
        return {
          claim: c.claim.trim(),
          importance: asNullableString(c.importance),
        };
      })
      .filter((c): c is NonNullable<typeof c> => Boolean(c)),
    tickers: tickers
      .map((ticker) => {
        const t = ticker as Record<string, unknown>;
        if (
          typeof t.symbol !== "string" ||
          typeof t.company_name !== "string" ||
          typeof t.rationale !== "string"
        ) {
          return null;
        }

        const confidenceRaw =
          typeof t.confidence === "string" ? t.confidence.toLowerCase() : "";
        const confidence: Confidence =
          confidenceRaw === "high" ||
          confidenceRaw === "medium" ||
          confidenceRaw === "speculative"
            ? confidenceRaw
            : "speculative";

        const mentionRaw =
          typeof t.mention_type === "string"
            ? t.mention_type.toLowerCase()
            : "";

        return {
          symbol: t.symbol.toUpperCase().replace(/[^A-Z0-9.\-]/g, ""),
          company_name: t.company_name.trim(),
          confidence,
          rationale: t.rationale.trim(),
          mention_type: normalizeMentionType(mentionRaw),
          themes: Array.isArray(t.themes)
            ? t.themes
                .filter((x): x is string => typeof x === "string")
                .map((x) => x.trim())
                .filter(Boolean)
            : [],
          value_chain_layer: asNullableString(t.value_chain_layer),
          thesis_link: asNullableString(t.thesis_link),
          time_horizon: asNullableString(t.time_horizon),
        };
      })
      .filter((t): t is NonNullable<typeof t> => Boolean(t?.symbol)),
  };
}

export async function researchSource(input: {
  title: string;
  url: string;
  showHost?: string | null;
  notes?: string | null;
  transcript: string;
}): Promise<ResearchResult> {
  const genAI = getClient();
  const model = genAI.getGenerativeModel({
    model: GEMINI_MODEL,
    generationConfig: {
      temperature: 0.35,
      responseMimeType: "application/json",
      maxOutputTokens: 16384,
    },
  });

  const prompt = `You are a deep-dive equity research analyst for X Equity Researcher.
You specialize in semiconductor / AI infrastructure / technical market structure interviews (e.g. SemiAnalysis-style).

MISSION
Do NOT produce a shallow list of the most obvious mega-cap names the speaker said out loud.
Your job is second-order research:
1) Extract the speaker's technical claims and exploding-market theses in depth.
2) Map each thesis through the full value chain.
3) Surface public equities that are investable expressions of those theses — especially names that are NOT the obvious headline tickers.

WHAT "DEEP" MEANS
- Capture magnitude claims (e.g. "inference will be bigger than oil") and treat them as market theses.
- Preserve technical specificity: architectures, bottlenecks, cost curves, power, cooling, networking, memory, packaging, foundry constraints, software/runtime, utilization, CapEx cycles.
- For each exploding market, walk the stack: power generation/transmission → cooling → data center RE/operators → networking/optics → accelerators/ASICs/GPUs → HBM/memory → substrates/packaging → foundry/equipment/EDA → cloud hyperscalers → application software.
- Prefer under-owned or less-obvious public beneficiaries when the thesis supports them (specialty suppliers, networking, power, cooling, memory, equipment) — not only NVDA/MSFT/GOOGL/AMZN/META/TSM.
- Explicit mentions still matter, but they should be a minority of the ticker list unless the transcript is thin.
- If a company is private but central, note it in claims/themes; only put public tickers in tickers[].

TICKER RULES
- mention_type "explicit": named or clearly referenced by the speaker.
- mention_type "second_order": NOT named, but a logical public equity expression of a market thesis / value-chain layer. THESE SHOULD BE THE MAJORITY.
- mention_type "related": adjacent exposure with weaker linkage.
- Aim for 15–35 tickers when the transcript is rich; fewer only if content is thin.
- At least ~60% of tickers should be second_order when possible.
- Avoid dumping the same 5 mega-caps for every AI transcript unless the rationale is thesis-specific and differentiated.
- Rationale must cite the thesis + value-chain layer + why THIS company wins/loses if the claim is true.
- Be honest with confidence. Speculative is fine when labeled.
- Use real ticker symbols. If unsure of symbol, still include best-effort symbol and note uncertainty in rationale.

OUTPUT
Return ONLY valid JSON matching this schema:
${RESEARCH_SCHEMA_HINT}

Source title: ${input.title}
URL: ${input.url}
Show/host: ${input.showHost || "n/a"}
Analyst notes: ${input.notes || "n/a"}

Transcript:
---
${input.transcript}
---`;

  const response = await model.generateContent(prompt);
  const text = response.response.text();
  const parsed = extractJson(text);
  return normalizeResult(parsed);
}
