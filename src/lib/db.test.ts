import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { EquityDraft, ThesisDraft } from "./research/types";
import { chunkTranscript, findQuoteAnchor } from "./research/chunk-transcript";

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
  it("persists linked evidence and equities through the staged research path", async () => {
    const { db, tmpDir } = await loadDbModule();
    try {
      const source = db.createSource({
        title: "Inference bottlenecks", url: "https://example.com",
        transcript: "Power and memory bandwidth are limiting inference growth.",
      });
      const segments = chunkTranscript(source.transcript);
      const run = db.createResearchRun(source.id, "test-model", segments);
      db.saveSegmentClaims(run.id, db.getSegments(run.id)[0], [{
        claim: "Power limits inference growth.", claimType: "bottleneck",
        importance: 5, confidence: "medium", quote: source.transcript,
        entities: [], valueChainLayers: ["power"],
      }], [findQuoteAnchor(segments[0], source.transcript)]);
      const [claim] = db.getClaimsForRun(run.id);
      expect(claim.quote_text).toBe(source.transcript);
      expect(db.getPendingSegments(run.id, 10)).toHaveLength(0);
      const thesisDraft: ThesisDraft = {
        title: "Power buildout", summary: "Power equipment constrains deployment.",
        technicalMechanism: "Denser racks require power delivery.",
        valueChainLayers: ["power"], magnitudeClaim: null,
        catalysts: ["Grid investment"], risks: ["Slower deployment"],
        confidence: "medium", claimUids: [claim.claim_uid],
      };
      db.replaceTheses(run.id, [thesisDraft, { ...thesisDraft, title: "Another expression of the same company" }]);
      const [thesis] = db.getThesesForRun(run.id);
      db.replaceWebSources(run.id, thesis.id, [{
        url: "https://example.com/filing", title: "Company filing", publisher: null,
        snippet: "Power systems are a business segment.", sourceType: "filing", credibility: "high",
      }]);
      const equityDraft: EquityDraft = {
        symbol: "TEST", companyName: "Example power supplier", exchange: "NYSE", country: "US",
        confidence: "medium", mentionType: "second_order", valueChainLayer: "power",
        timeHorizon: "multi-year", exposureScore: 5, purityScore: 4, asymmetryScore: 3,
        rationale: "Power systems supply the deployment bottleneck.", catalysts: ["Grid investment"],
        risks: ["Slower deployment"], falsifiers: ["No order growth"], valuationQuestions: [],
        claimUids: [claim.claim_uid], webSourceUrls: ["https://example.com/filing"],
      };
      db.saveThesisEquities(run.id, thesis, [equityDraft]);
      const otherThesis = db.getThesesForRun(run.id)[1];
      db.replaceWebSources(run.id, otherThesis.id, db.getWebSources(run.id, thesis.id).map((source) => ({
        url: source.url, title: source.title, publisher: source.publisher, snippet: source.snippet,
        sourceType: source.source_type, credibility: source.credibility,
      })));
      db.saveThesisEquities(run.id, otherThesis, [equityDraft]);
      expect(db.getRunTickers(run.id)).toHaveLength(1);
      db.saveReportSection(run.id, thesis.id, "power", thesis.title, "Evidence-backed chapter.", 1);
      db.completeResearchRun(run.id, "Power limits deployment.", [], 100);
      expect(db.getSourceDetail(source.id)?.tickers[0]).toMatchObject({
        symbol: "TEST", exchange: "NYSE", exposure_score: 5, grounded: 1,
      });
      expect(db.getThesisDetail(source.id, thesis.id)?.tickers[0].symbol).toBe("TEST");
      expect(db.getThesisDetail(source.id, otherThesis.id)?.tickers[0].symbol).toBe("TEST");
      expect(db.getThesisDetail(source.id, thesis.id)?.evidence[0].claim_uid).toBe(claim.claim_uid);
      expect(db.getSourceClaims(source.id)?.claims).toHaveLength(1);
      expect(db.getCompanyDossier(source.id, "TEST")?.falsifiers).toBe('["No order growth"]');
      expect(db.getResearchSections(run.id)[0].body_markdown).toBe("Evidence-backed chapter.");

      // A new run must audit its own missing links, even while the source
      // overview still displays the previous, fully linked result.
      const next = db.createResearchRun(source.id, "test-model", segments);
      db.replaceTheses(next.id, [{ ...thesisDraft, claimUids: [] }]);
      db.saveThesisEquities(next.id, db.getThesesForRun(next.id)[0], [{
        ...equityDraft, claimUids: [], webSourceUrls: [],
      }]);
      db.setRunStage(next.id, "audit", 0, 1);
      const { advanceResearchRun } = await import("./research/pipeline");
      const audited = await advanceResearchRun(next.id);
      expect(audited.status).toBe("completed");
      expect(JSON.parse(audited.quality_notes ?? "[]")).toContain(
        "Some ticker expressions lack both transcript and web citation linkage.",
      );
    } finally {
      db.closeDbForTest();
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("keeps prior completed runs and persists resumable segment state", async () => {
    const { db, tmpDir } = await loadDbModule();
    const source = db.createSource({ title: "Versioned run", url: "https://example.com", transcript: "A technical bottleneck exists.\n\nIt constrains capacity." });
    const first = db.createResearchRun(source.id, "test-model", chunkTranscript(source.transcript));
    expect(first.status).toBe("queued");
    expect(first.segment_total).toBeGreaterThan(0);
    db.setRunStage(first.id, "segment_extraction", 0, first.segment_total);
    const active = db.getResearchRunStatus(first.id);
    expect(active?.current_stage).toBe("segment_extraction");
    expect(db.getPendingSegments(first.id, 10)).toHaveLength(first.segment_total);
    db.completeResearchRun(first.id, "First run", [], 100);
    const second = db.createResearchRun(source.id, "test-model", chunkTranscript(source.transcript));
    expect(second.id).toBeGreaterThan(first.id);
    expect(db.getSourceDetail(source.id)?.research?.id).toBe(first.id);
    expect(db.getActiveResearchRun(source.id)?.id).toBe(second.id);
    db.setRunStage(second.id, "segment_extraction", 0, second.segment_total);
    db.failResearchRun(second.id, "Temporary provider outage");
    expect(db.getResearchRunStatus(second.id)?.status).toBe("error");
    expect(db.retryResearchRun(second.id)).toMatchObject({
      status: "running",
      current_stage: "segment_extraction",
    });
    db.failResearchRun(second.id, "Abandoned run");
    const third = db.createResearchRun(source.id, "test-model", chunkTranscript(source.transcript));
    db.completeResearchRun(third.id, "Latest research", [], 100);
    expect(db.getActiveResearchRun(source.id)).toBeUndefined();
    expect(db.getSourceDetail(source.id)?.active_run).toBeNull();
    expect(db.listSources()[0].research_summary).toBe("Latest research");
    db.closeDbForTest();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });
});
