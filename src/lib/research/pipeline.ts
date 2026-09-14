import {
  addRunUsage, completeResearchRun, failResearchRun, getClaimsForRun, getPendingSegments,
  getResearchRunStatus, getRunTickers, getSegments, getThesesForRun,
  getThesisEvidence, getWebSources, replaceTheses, replaceWebSources, saveReportSection,
  saveSegmentClaims, saveThesisEquities, setRunStage,
} from "../db";
import type { ResearchRunStatusDetail } from "../types";
import { auditResearch } from "./audit-report";
import { buildTheses } from "./build-theses";
import { findQuoteAnchor } from "./chunk-transcript";
import { extractSegment } from "./extract-segment";
import { groundThesis } from "./ground-theses";
import { mapEquities } from "./map-equities";
import { writeThesisSection } from "./write-report";

const SEGMENT_BATCH_SIZE = 2;

function parseStringArray(value: string | null): string[] {
  if (!value) return [];
  try { const parsed = JSON.parse(value); return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : []; } catch { return []; }
}

async function extractNextSegments(run: ResearchRunStatusDetail) {
  const segments = getPendingSegments(run.id, SEGMENT_BATCH_SIZE);
  if (!segments.length) { setRunStage(run.id, "thesis_building", 0, 1); return; }
  const results = await Promise.allSettled(segments.map(async (segment) => {
    const input = { uid: segment.segment_uid, index: segment.segment_index, startOffset: segment.start_offset, endOffset: segment.end_offset, text: segment.text };
    const output = await extractSegment(input);
    saveSegmentClaims(run.id, segment, output.data.claims, output.data.claims.map((claim) => findQuoteAnchor(input, claim.quote)));
    addRunUsage(run.id, output.usage);
  }));
  const failed = results.find((result) => result.status === "rejected");
  if (failed?.status === "rejected") throw failed.reason;
  const next = getResearchRunStatus(run.id)!;
  if (next.segment_processed >= next.segment_total) setRunStage(run.id, "thesis_building", 0, 1);
  else setRunStage(run.id, "segment_extraction", next.segment_processed, next.segment_total);
}

async function buildRunTheses(run: ResearchRunStatusDetail) {
  const claims = getClaimsForRun(run.id).filter((claim) => claim.match_kind === "exact" || claim.match_kind === "normalized");
  if (!claims.length) throw new Error("No reliably matched transcript claims were extracted. Inspect the evidence ledger and original transcript before trying a new source.");
  const result = await buildTheses(claims.map((claim) => ({
    uid: claim.claim_uid, claim: claim.claim, quote: claim.quote_text, claimType: claim.claim_type,
    importance: claim.importance, valueChainLayers: parseStringArray(claim.value_chain_layers),
  })));
  replaceTheses(run.id, result.theses);
  addRunUsage(run.id, result.usage);
  setRunStage(run.id, "web_verification", 0, result.theses.length);
}

async function groundNextThesis(run: ResearchRunStatusDetail) {
  const theses = getThesesForRun(run.id);
  const index = Math.min(run.progress_current ?? 0, theses.length);
  if (index >= theses.length) { setRunStage(run.id, "equity_mapping", 0, theses.length); return; }
  const thesis = theses[index];
  const evidence = getThesisEvidence(thesis.id).map((claim) => ({ uid: claim.claim_uid, claim: claim.claim, quote: claim.quote_text }));
  const result = await groundThesis({ thesis: { title: thesis.title, summary: thesis.summary, technicalMechanism: thesis.technical_mechanism, valueChainLayers: parseStringArray(thesis.value_chain_layers), magnitudeClaim: thesis.magnitude_claim, catalysts: parseStringArray(thesis.catalysts), risks: parseStringArray(thesis.risks), confidence: thesis.confidence, claimUids: evidence.map((claim) => claim.uid) }, evidence });
  replaceWebSources(run.id, thesis.id, result.sources);
  addRunUsage(run.id, result.usage);
  setRunStage(run.id, "web_verification", index + 1, theses.length);
}

async function mapNextThesis(run: ResearchRunStatusDetail) {
  const theses = getThesesForRun(run.id); const index = Math.min(run.progress_current ?? 0, theses.length);
  if (index >= theses.length) { setRunStage(run.id, "report_writing", 0, theses.length); return; }
  const thesis = theses[index];
  const claims = getThesisEvidence(thesis.id).map((claim) => ({ uid: claim.claim_uid, claim: claim.claim, quote: claim.quote_text }));
  const sources = getWebSources(run.id, thesis.id).map((source) => ({ url: source.url, title: source.title, snippet: source.snippet }));
  if (!sources.length) throw new Error(`No web sources were persisted for ${thesis.title}; retry web verification.`);
  const result = await mapEquities({ thesis: { title: thesis.title, summary: thesis.summary, technicalMechanism: thesis.technical_mechanism, valueChainLayers: parseStringArray(thesis.value_chain_layers), magnitudeClaim: thesis.magnitude_claim, catalysts: parseStringArray(thesis.catalysts), risks: parseStringArray(thesis.risks), confidence: thesis.confidence, claimUids: claims.map((claim) => claim.uid) }, claims, webSources: sources });
  saveThesisEquities(run.id, thesis, result.equities);
  addRunUsage(run.id, result.usage);
  setRunStage(run.id, "equity_mapping", index + 1, theses.length);
}

async function writeNextSection(run: ResearchRunStatusDetail) {
  const theses = getThesesForRun(run.id); const index = Math.min(run.progress_current ?? 0, theses.length);
  if (index >= theses.length) { setRunStage(run.id, "audit", 0, 1); return; }
  const thesis = theses[index];
  const claims = getThesisEvidence(thesis.id).map((claim) => ({ uid: claim.claim_uid, claim: claim.claim, quote: claim.quote_text }));
  const sources = getWebSources(run.id, thesis.id).map((source) => ({ url: source.url, title: source.title, snippet: source.snippet }));
  const equities = getRunTickers(run.id).filter((ticker) => ticker.thesis_id === thesis.id).map((ticker) => ({ symbol: ticker.symbol, companyName: ticker.company_name, rationale: ticker.rationale }));
  const result = await writeThesisSection({ thesis: { title: thesis.title, summary: thesis.summary, technicalMechanism: thesis.technical_mechanism, valueChainLayers: parseStringArray(thesis.value_chain_layers), magnitudeClaim: thesis.magnitude_claim, catalysts: parseStringArray(thesis.catalysts), risks: parseStringArray(thesis.risks), confidence: thesis.confidence, claimUids: claims.map((claim) => claim.uid) }, claims, sources, equities });
  saveReportSection(run.id, thesis.id, `thesis-${thesis.id}`, thesis.title, result.bodyMarkdown, index + 1);
  addRunUsage(run.id, result.usage);
  setRunStage(run.id, "report_writing", index + 1, theses.length);
}

function auditRun(run: ResearchRunStatusDetail) {
  const segments = getSegments(run.id); const segmentMap = new Map(segments.map((segment) => [segment.id, segment.text]));
  const claims = getClaimsForRun(run.id);
  const audit = auditResearch({
    segmentsTotal: segments.length, segmentsProcessed: segments.filter((segment) => segment.status === "processed").length,
    quotes: claims.map((claim) => ({ quoteText: claim.quote_text, segmentText: segmentMap.get(claim.segment_id) ?? "" })),
    tickers: getRunTickers(run.id).map((ticker) => ({ hasClaim: Boolean(ticker.grounded), hasWebSource: Boolean(ticker.grounded) })),
    unverifiedQuotes: segments.reduce((total, segment) => total + (segment.claims_unverified ?? 0), 0),
    emptySegments: segments.filter((segment) => segment.status === "processed" && !segment.claims_extracted).length,
  });
  const summary = getThesesForRun(run.id).map((thesis) => thesis.summary).join(" ").slice(0, 1_800) || "Evidence-first research run completed.";
  completeResearchRun(run.id, summary, audit.notes, audit.coverage);
}

async function advanceRun(runId: number): Promise<ResearchRunStatusDetail> {
  const run = getResearchRunStatus(runId);
  if (!run) throw new Error("Research run not found.");
  if (run.status === "completed" || run.status === "error") return run;
  try {
    switch (run.current_stage) {
      case "queued": setRunStage(run.id, "segment_extraction", 0, run.segment_total); break;
      case "segment_extraction": await extractNextSegments(run); break;
      case "thesis_building": await buildRunTheses(run); break;
      case "web_verification": await groundNextThesis(run); break;
      case "equity_mapping": await mapNextThesis(run); break;
      case "report_writing": await writeNextSection(run); break;
      case "audit": auditRun(run); break;
      default: throw new Error(`Unsupported research stage: ${run.current_stage}`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Research stage failed.";
    failResearchRun(run.id, message);
  }
  return getResearchRunStatus(runId)!;
}

// Share a stage request across tabs in this local server. A second click must
// not repeat paid calls or persist the same segment twice.
const inFlight = new Map<number, Promise<ResearchRunStatusDetail>>();
export function advanceResearchRun(runId: number): Promise<ResearchRunStatusDetail> {
  const pending = inFlight.get(runId);
  if (pending) return pending;
  const next = advanceRun(runId).finally(() => inFlight.delete(runId));
  inFlight.set(runId, next);
  return next;
}
