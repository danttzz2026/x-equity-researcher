import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ResearchResult } from "./types";

async function loadDbModule() {
  vi.resetModules();
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "x-equity-db-"));
  process.env.X_EQUITY_DB_PATH = path.join(tmpDir, "test.db");
  return {
    tmpDir,
    db: await import("./db"),
  };
}

afterEach(() => {
  delete process.env.X_EQUITY_DB_PATH;
});

describe("db research persistence", () => {
  it("roundtrips rich research fields through SQLite", async () => {
    const { db, tmpDir } = await loadDbModule();
    const source = db.createSource({
      title: "Inference bottlenecks",
      url: "https://example.com",
      transcript: "Power and memory bandwidth are limiting inference growth.",
    });

    const result: ResearchResult = {
      summary: "Inference demand stresses power, HBM, and networking.",
      quality_notes: ["Evidence coverage is acceptable."],
      themes: [
        {
          name: "Power scarcity",
          sector: "AI infrastructure",
          description: "Grid access gates data center growth.",
          market_structure: "Equipment suppliers capture scarcity value.",
        },
      ],
      market_theses: [
        {
          name: "Inference power buildout",
          magnitude_claim: "multi-year capex wave",
          technical_driver: "Denser racks need more grid and cooling capacity.",
          value_chain: "power -> cooling -> networking",
          why_it_matters: "Second-order suppliers may be cleaner exposure.",
          time_horizon: "multi-year",
          evidence_snippets: ["power limits inference deployment"],
        },
      ],
      claims: [
        {
          claim: "Power availability is a deployment bottleneck.",
          importance: "Grid equipment demand rises.",
          evidence_snippet: "power is the limiter",
        },
      ],
      tickers: [
        {
          symbol: "VRT",
          company_name: "Vertiv",
          confidence: "medium",
          rationale: "Thermal and power systems express denser AI racks.",
          mention_type: "second_order",
          themes: ["Power scarcity"],
          value_chain_layer: "cooling",
          thesis_link: "Inference power buildout",
          time_horizon: "multi-year",
          exchange: "NYSE",
          country: "US",
          exposure_score: 5,
          purity_score: 4,
          asymmetry_score: 4,
          mega_cap: false,
          evidence_snippet: "denser racks need more cooling",
          counter_thesis: "Rack density growth pauses or hyperscalers insource.",
        },
      ],
    };

    db.saveResearchResult(source.id, "test-model", result);
    const detail = db.getSourceDetail(source.id);

    expect(detail?.research?.quality_notes).toBe(
      JSON.stringify(["Evidence coverage is acceptable."]),
    );
    expect(detail?.market_theses[0].evidence_snippets).toBe(
      JSON.stringify(["power limits inference deployment"]),
    );
    expect(detail?.claims[0].evidence_snippet).toBe("power is the limiter");
    expect(detail?.tickers[0]).toMatchObject({
      symbol: "VRT",
      exchange: "NYSE",
      country: "US",
      exposure_score: 5,
      purity_score: 4,
      asymmetry_score: 4,
      mega_cap: 0,
      evidence_snippet: "denser racks need more cooling",
    });

    db.closeDbForTest();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });
});
