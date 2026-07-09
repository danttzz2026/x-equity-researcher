import { GoogleGenerativeAI } from "@google/generative-ai";
import type { Confidence, MentionType, ResearchResult } from "./types";

/** Default: Gemini 3.5 Flash — current stable high-quality model. Override with GEMINI_MODEL. */
export const GEMINI_MODEL =
  process.env.GEMINI_MODEL?.trim() || "gemini-3.5-flash";

const OBVIOUS_AI_ANCHORS = new Set([
  "NVDA",
  "MSFT",
  "GOOGL",
  "GOOG",
  "AMZN",
  "META",
  "TSM",
  "TSMC",
  "AVGO",
]);

const VALUE_CHAIN_LAYERS = [
  "power",
  "grid",
  "cooling",
  "data center",
  "networking",
  "optics",
  "accelerators",
  "asic",
  "memory",
  "hbm",
  "packaging",
  "substrate",
  "foundry",
  "equipment",
  "eda",
  "software",
  "cloud",
];

const THESIS_SCHEMA_HINT = `{
  "summary": "4-7 sentence deep research brief focused on non-obvious market theses, bottlenecks, and investable implications",
  "themes": [
    {
      "name": "short technical theme",
      "sector": "sector or null",
      "description": "technical detail from the transcript",
      "market_structure": "who captures value / competitive dynamics or null"
    }
  ],
  "market_theses": [
    {
      "name": "exploding or structurally important market",
      "magnitude_claim": "speaker's size/growth claim or null",
      "technical_driver": "why the market expands technically",
      "value_chain": "layers that benefit, separated with arrows or commas",
      "why_it_matters": "equity-investor implication",
      "time_horizon": "near-term / medium / multi-year or null",
      "evidence_snippets": ["short transcript snippet supporting the thesis"]
    }
  ],
  "claims": [
    {
      "claim": "specific technical or market claim",
      "importance": "second-order investable implication or null",
      "evidence_snippet": "short transcript snippet supporting the claim or null"
    }
  ]
}`;

const TICKER_SCHEMA_HINT = `{
  "tickers": [
    {
      "symbol": "public ticker",
      "company_name": "Company Name",
      "exchange": "NASDAQ / NYSE / TSE / HKEX / etc. or null",
      "country": "primary listing country or null",
      "confidence": "high|medium|speculative",
      "mention_type": "explicit|second_order|related",
      "themes": ["theme or thesis names"],
      "value_chain_layer": "specific layer such as HBM, optics, liquid cooling, grid equipment, advanced packaging",
      "thesis_link": "market thesis name this expresses",
      "time_horizon": "near-term / medium / multi-year or null",
      "exposure_score": 1-5,
      "purity_score": 1-5,
      "asymmetry_score": 1-5,
      "rationale": "2-4 sentences: thesis + layer + why this company is a differentiated expression",
      "evidence_snippet": "short transcript snippet that grounds the source thesis, not necessarily the ticker itself",
      "counter_thesis": "what would make this expression wrong or less powerful"
    }
  ]
}`;

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

export function extractJson(text: string): unknown {
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

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((x): x is string => typeof x === "string")
    .map((x) => x.trim())
    .filter(Boolean);
}

function clampScore(value: unknown): number {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number.parseInt(value, 10)
        : 3;
  if (!Number.isFinite(parsed)) return 3;
  return Math.min(5, Math.max(1, Math.round(parsed)));
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

function normalizeSymbol(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9.\-]/g, "");
}

export function isMegaCapAnchor(symbol: string): boolean {
  return OBVIOUS_AI_ANCHORS.has(normalizeSymbol(symbol));
}

export function normalizeResult(raw: unknown): ResearchResult {
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
    quality_notes: asStringArray(data.quality_notes),
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
          evidence_snippets: asStringArray(t.evidence_snippets),
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
          evidence_snippet: asNullableString(c.evidence_snippet),
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

        const symbol = normalizeSymbol(t.symbol);
        if (!symbol) return null;

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

        const modelMegaCap =
          typeof t.mega_cap === "boolean"
            ? t.mega_cap
            : typeof t.mega_cap === "number"
              ? t.mega_cap === 1
              : false;

        return {
          symbol,
          company_name: t.company_name.trim(),
          confidence,
          rationale: t.rationale.trim(),
          mention_type: normalizeMentionType(mentionRaw),
          themes: asStringArray(t.themes),
          value_chain_layer: asNullableString(t.value_chain_layer),
          thesis_link: asNullableString(t.thesis_link),
          time_horizon: asNullableString(t.time_horizon),
          exchange: asNullableString(t.exchange),
          country: asNullableString(t.country),
          exposure_score: clampScore(t.exposure_score),
          purity_score: clampScore(t.purity_score),
          asymmetry_score: clampScore(t.asymmetry_score),
          mega_cap: modelMegaCap || isMegaCapAnchor(symbol),
          evidence_snippet: asNullableString(t.evidence_snippet),
          counter_thesis: asNullableString(t.counter_thesis),
        };
      })
      .filter((t): t is NonNullable<typeof t> => Boolean(t)),
  };
}

export function evaluateResearchQuality(result: ResearchResult): string[] {
  const notes: string[] = [];
  const tickerCount = result.tickers.length;
  const secondOrder = result.tickers.filter(
    (t) => t.mention_type === "second_order",
  ).length;
  const megaCaps = result.tickers.filter((t) => t.mega_cap).length;
  const secondOrderShare = tickerCount ? secondOrder / tickerCount : 0;
  const megaCapShare = tickerCount ? megaCaps / tickerCount : 0;
  const layers = new Set(
    result.tickers
      .map((t) => t.value_chain_layer?.toLowerCase() || "")
      .filter(Boolean),
  );
  const evidenceCount =
    result.tickers.filter((t) => t.evidence_snippet).length +
    result.claims.filter((c) => c.evidence_snippet).length;
  const evidenceDenominator = tickerCount + result.claims.length;
  const evidenceShare = evidenceDenominator
    ? evidenceCount / evidenceDenominator
    : 0;

  if (tickerCount < 12) {
    notes.push("Ticker map is thin; rich sources should usually produce 12+ public expressions.");
  }
  if (tickerCount >= 8 && secondOrderShare < 0.55) {
    notes.push("Second-order share is below target; obvious or named exposures may dominate.");
  }
  if (tickerCount >= 8 && megaCapShare > 0.35) {
    notes.push("Mega-cap anchor share is high; review for shallow AI basket behavior.");
  }
  if (layers.size < 5) {
    notes.push("Value-chain coverage is narrow; missing layers may hide better second-order names.");
  }
  if (evidenceDenominator >= 8 && evidenceShare < 0.8) {
    notes.push("Transcript grounding is light; evidence snippets should support most claims and tickers.");
  }

  return notes;
}

function combineResearch(
  thesisPass: ResearchResult,
  tickerPass: ResearchResult,
): ResearchResult {
  return {
    ...thesisPass,
    tickers: tickerPass.tickers,
    quality_notes: [...thesisPass.quality_notes, ...tickerPass.quality_notes],
  };
}

function sourceHeader(input: {
  title: string;
  url: string;
  showHost?: string | null;
  notes?: string | null;
}) {
  return `Source title: ${input.title}
URL: ${input.url}
Show/host: ${input.showHost || "n/a"}
Analyst notes: ${input.notes || "n/a"}`;
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
      temperature: 0.32,
      responseMimeType: "application/json",
      maxOutputTokens: 16384,
    },
  });

  const header = sourceHeader(input);
  const thesisPrompt = `You are X Equity Researcher's technical equity research analyst.
Extract the source's investable market structure before thinking about tickers.

Rules:
- Do not recap the episode. Pull out exploding markets, technical bottlenecks, and claims an investor could underwrite.
- Ground every major thesis in one or more short transcript snippets.
- Preserve the value chain: ${VALUE_CHAIN_LAYERS.join(", ")}.
- If the speaker makes a large magnitude claim, elevate it into market_theses.

Return ONLY valid JSON matching:
${THESIS_SCHEMA_HINT}

${header}

Transcript:
---
${input.transcript}
---`;

  const thesisResponse = await model.generateContent(thesisPrompt);
  const thesisPass = normalizeResult(extractJson(thesisResponse.response.text()));

  const tickerPrompt = `You are X Equity Researcher's second-order public equities mapper.
Use the extracted theses and transcript to identify public equities that express the source's market theses.

Rules:
- Prefer second-order beneficiaries over obvious mega-cap anchors.
- Obvious anchors (${Array.from(OBVIOUS_AI_ANCHORS).join(", ")}) are allowed only when thesis-specific and differentiated.
- Aim for 15-35 tickers on rich transcripts, with second_order as the majority.
- Cover at least 5 distinct value-chain layers when supported.
- Include exchange/country when a ticker is numeric or non-US.
- Scores are 1-5:
  exposure_score = sensitivity to the thesis,
  purity_score = how cleanly the public company maps to the layer,
  asymmetry_score = how underappreciated or convex the expression may be.
- Every rationale must name the thesis, value-chain layer, and why this company specifically benefits or is at risk.
- Add a concise counter_thesis for every ticker.
- evidence_snippet should quote or paraphrase the transcript claim that grounds the thesis behind the ticker.

Return ONLY valid JSON matching:
${TICKER_SCHEMA_HINT}

${header}

Extracted thesis JSON:
${JSON.stringify(thesisPass)}

Transcript:
---
${input.transcript}
---`;

  const tickerResponse = await model.generateContent(tickerPrompt);
  let result = combineResearch(
    thesisPass,
    normalizeResult(extractJson(tickerResponse.response.text())),
  );

  const initialNotes = evaluateResearchQuality(result);
  if (initialNotes.length) {
    const repairPrompt = `You are the critique and repair pass for X Equity Researcher.
The draft research failed these quality checks:
${initialNotes.map((note) => `- ${note}`).join("\n")}

Repair the FULL JSON result. Keep strong existing work, but improve ticker depth, second-order coverage, layer diversity, transcript evidence, and counter-theses.
Do not fabricate transcript evidence; if evidence is thin, say so in quality_notes.
Return ONLY valid JSON with summary, quality_notes, themes, market_theses, claims, and tickers using the prior schemas.

Current draft:
${JSON.stringify(result)}

${header}

Transcript:
---
${input.transcript}
---`;

    const repairResponse = await model.generateContent(repairPrompt);
    result = normalizeResult(extractJson(repairResponse.response.text()));
  }

  const finalNotes = Array.from(
    new Set([...result.quality_notes, ...evaluateResearchQuality(result)]),
  );
  return { ...result, quality_notes: finalNotes };
}

export const researchInternalsForTest = {
  clampScore,
  normalizeMentionType,
  normalizeSymbol,
};
