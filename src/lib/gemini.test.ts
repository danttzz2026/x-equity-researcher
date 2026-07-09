import { describe, expect, it } from "vitest";
import {
  evaluateResearchQuality,
  extractJson,
  isMegaCapAnchor,
  normalizeResult,
} from "./gemini";

describe("gemini normalization", () => {
  it("extracts fenced JSON", () => {
    expect(extractJson("```json\n{\"ok\":true}\n```")).toEqual({ ok: true });
  });

  it("normalizes rich ticker fields and clamps scores", () => {
    const result = normalizeResult({
      summary: "AI infrastructure brief",
      quality_notes: ["check edge exposure"],
      themes: [
        {
          name: "HBM bottleneck",
          description: "Memory bandwidth constrains inference.",
        },
      ],
      market_theses: [
        {
          name: "Inference memory wall",
          why_it_matters: "Memory suppliers and testers gain leverage.",
          evidence_snippets: ["memory bandwidth is the limiter"],
        },
      ],
      claims: [
        {
          claim: "Inference drives more HBM attach.",
          evidence_snippet: "HBM attach rises with larger models.",
        },
      ],
      tickers: [
        {
          symbol: " nvda ",
          company_name: "NVIDIA",
          confidence: "HIGH",
          mention_type: "beneficiary",
          rationale: "GPU leader exposed to accelerator attach.",
          exposure_score: 8,
          purity_score: "0",
          asymmetry_score: "4",
          evidence_snippet: "accelerators remain constrained",
        },
      ],
    });

    expect(result.quality_notes).toEqual(["check edge exposure"]);
    expect(result.tickers[0]).toMatchObject({
      symbol: "NVDA",
      confidence: "high",
      mention_type: "second_order",
      exposure_score: 5,
      purity_score: 1,
      asymmetry_score: 4,
      mega_cap: true,
    });
    expect(result.market_theses[0].evidence_snippets).toEqual([
      "memory bandwidth is the limiter",
    ]);
  });

  it("flags shallow research with quality notes", () => {
    const result = normalizeResult({
      summary: "thin",
      themes: [],
      market_theses: [],
      claims: [],
      tickers: [
        {
          symbol: "NVDA",
          company_name: "NVIDIA",
          confidence: "high",
          mention_type: "explicit",
          rationale: "Named AI winner.",
          value_chain_layer: "accelerators",
        },
      ],
    });

    expect(isMegaCapAnchor("NVDA")).toBe(true);
    expect(evaluateResearchQuality(result).length).toBeGreaterThan(0);
  });
});
