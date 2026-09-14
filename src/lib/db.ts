import type { EvidenceClaim } from "./types";
import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import type {
  Claim, CompanyDossier, MarketThesis, ResearchRun, ResearchRunStatusDetail,
  ResearchSection, ResearchStage, ResearchThesis, Source, SourceDetail, SourceListItem,
  SourceStatus, Theme, TickerDetail, TickerListItem, TranscriptSegment, WebSource,
} from "./types";
import type { EquityDraft, ExtractedClaim, SegmentInput, ThesisDraft, Usage } from "./research/types";
import type { QuoteAnchor } from "./research/chunk-transcript";
import { estimateCostUsd } from "./research/model";

const DATA_DIR = path.join(process.cwd(), "data");
const DB_PATH = process.env.X_EQUITY_DB_PATH?.trim() || path.join(DATA_DIR, "x-equity.db");
let dbInstance: Database.Database | null = null;

function ensureDataDir() {
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

export function getDb(): Database.Database {
  if (dbInstance) return dbInstance;
  ensureDataDir();
  dbInstance = new Database(DB_PATH);
  dbInstance.pragma("journal_mode = WAL");
  dbInstance.pragma("foreign_keys = ON");
  migrate(dbInstance);
  return dbInstance;
}

export function closeDbForTest() { dbInstance?.close(); dbInstance = null; }

function tableExists(db: Database.Database, table: string) {
  return Boolean(db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?").get(table));
}
function tableColumns(db: Database.Database, table: string): Set<string> {
  return new Set((db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>).map((row) => row.name));
}
function ensureColumn(db: Database.Database, table: string, column: string, definition: string) {
  if (!tableColumns(db, table).has(column)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
}
function hasUniqueSourceRunIndex(db: Database.Database) {
  const indexes = db.prepare("PRAGMA index_list(research_runs)").all() as Array<{ name: string; unique: number }>;
  return indexes.some((index) => index.unique === 1 && (db.prepare(`PRAGMA index_info(${index.name})`).all() as Array<{ name: string }>).some((column) => column.name === "source_id"));
}

function createResearchRunsTable(db: Database.Database, table = "research_runs") {
  db.exec(`CREATE TABLE IF NOT EXISTS ${table} (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source_id INTEGER NOT NULL,
    model TEXT NOT NULL,
    summary TEXT NOT NULL DEFAULT '',
    quality_notes TEXT,
    status TEXT NOT NULL DEFAULT 'completed',
    current_stage TEXT NOT NULL DEFAULT 'completed',
    progress_current INTEGER NOT NULL DEFAULT 0,
    progress_total INTEGER NOT NULL DEFAULT 0,
    coverage_pct INTEGER NOT NULL DEFAULT 0,
    input_tokens INTEGER NOT NULL DEFAULT 0,
    output_tokens INTEGER NOT NULL DEFAULT 0,
    estimated_cost_usd REAL NOT NULL DEFAULT 0,
    error_message TEXT,
    started_at TEXT,
    completed_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (source_id) REFERENCES sources(id) ON DELETE CASCADE
  )`);
}

function rebuildResearchRunsIfNeeded(db: Database.Database) {
  if (!tableExists(db, "research_runs") || !hasUniqueSourceRunIndex(db)) return;
  db.pragma("foreign_keys = OFF");
  try {
    db.exec("DROP TABLE IF EXISTS research_runs_replacement");
    createResearchRunsTable(db, "research_runs_replacement");
    db.exec(`INSERT INTO research_runs_replacement (id, source_id, model, summary, quality_notes, created_at)
      SELECT id, source_id, model, summary, quality_notes, created_at FROM research_runs`);
    db.exec("DROP TABLE research_runs");
    db.exec("ALTER TABLE research_runs_replacement RENAME TO research_runs");
  } finally {
    db.pragma("foreign_keys = ON");
  }
}

function migrate(db: Database.Database) {
  db.exec(`CREATE TABLE IF NOT EXISTS sources (
    id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, url TEXT NOT NULL, show_host TEXT,
    notes TEXT, transcript TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'draft', error_message TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );`);
  rebuildResearchRunsIfNeeded(db);
  createResearchRunsTable(db);
  for (const [column, definition] of [
    ["quality_notes", "TEXT"], ["status", "TEXT NOT NULL DEFAULT 'completed'"], ["current_stage", "TEXT NOT NULL DEFAULT 'completed'"],
    ["progress_current", "INTEGER NOT NULL DEFAULT 0"], ["progress_total", "INTEGER NOT NULL DEFAULT 0"], ["coverage_pct", "INTEGER NOT NULL DEFAULT 0"],
    ["input_tokens", "INTEGER NOT NULL DEFAULT 0"], ["output_tokens", "INTEGER NOT NULL DEFAULT 0"], ["estimated_cost_usd", "REAL NOT NULL DEFAULT 0"],
    ["error_message", "TEXT"], ["started_at", "TEXT"], ["completed_at", "TEXT"], ["updated_at", "TEXT NOT NULL DEFAULT ''"],
  ] as const) ensureColumn(db, "research_runs", column, definition);
  db.exec(`UPDATE research_runs SET status = COALESCE(NULLIF(status, ''), 'completed'), current_stage = COALESCE(NULLIF(current_stage, ''), 'completed'), updated_at = CASE WHEN updated_at = '' THEN created_at ELSE updated_at END`);

  db.exec(`CREATE TABLE IF NOT EXISTS themes (
    id INTEGER PRIMARY KEY AUTOINCREMENT, research_run_id INTEGER NOT NULL, name TEXT NOT NULL, sector TEXT,
    description TEXT NOT NULL, market_structure TEXT, FOREIGN KEY (research_run_id) REFERENCES research_runs(id) ON DELETE CASCADE
  );
  CREATE TABLE IF NOT EXISTS market_theses (
    id INTEGER PRIMARY KEY AUTOINCREMENT, research_run_id INTEGER NOT NULL, name TEXT NOT NULL, magnitude_claim TEXT,
    technical_driver TEXT, value_chain TEXT, why_it_matters TEXT NOT NULL, time_horizon TEXT, evidence_snippets TEXT,
    FOREIGN KEY (research_run_id) REFERENCES research_runs(id) ON DELETE CASCADE
  );
  CREATE TABLE IF NOT EXISTS claims (
    id INTEGER PRIMARY KEY AUTOINCREMENT, research_run_id INTEGER NOT NULL, claim TEXT NOT NULL, importance TEXT, evidence_snippet TEXT,
    FOREIGN KEY (research_run_id) REFERENCES research_runs(id) ON DELETE CASCADE
  );
  CREATE TABLE IF NOT EXISTS tickers (
    id INTEGER PRIMARY KEY AUTOINCREMENT, symbol TEXT NOT NULL UNIQUE, company_name TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS ticker_mentions (
    id INTEGER PRIMARY KEY AUTOINCREMENT, research_run_id INTEGER NOT NULL, ticker_id INTEGER NOT NULL, confidence TEXT NOT NULL,
    rationale TEXT NOT NULL, mention_type TEXT NOT NULL, themes TEXT, value_chain_layer TEXT, thesis_link TEXT, time_horizon TEXT,
    exchange TEXT, country TEXT, exposure_score INTEGER NOT NULL DEFAULT 3, purity_score INTEGER NOT NULL DEFAULT 3,
    asymmetry_score INTEGER NOT NULL DEFAULT 3, mega_cap INTEGER NOT NULL DEFAULT 0, evidence_snippet TEXT, counter_thesis TEXT,
    FOREIGN KEY (research_run_id) REFERENCES research_runs(id) ON DELETE CASCADE, FOREIGN KEY (ticker_id) REFERENCES tickers(id) ON DELETE CASCADE,
    UNIQUE(research_run_id, ticker_id)
  );`);
  for (const [column, definition] of [
    ["evidence_snippets", "TEXT"],
  ] as const) ensureColumn(db, "market_theses", column, definition);
  for (const [column, definition] of [["evidence_snippet", "TEXT"]] as const) ensureColumn(db, "claims", column, definition);
  for (const [column, definition] of [
    ["value_chain_layer", "TEXT"], ["thesis_link", "TEXT"], ["time_horizon", "TEXT"], ["exchange", "TEXT"], ["country", "TEXT"],
    ["exposure_score", "INTEGER NOT NULL DEFAULT 3"], ["purity_score", "INTEGER NOT NULL DEFAULT 3"], ["asymmetry_score", "INTEGER NOT NULL DEFAULT 3"],
    ["mega_cap", "INTEGER NOT NULL DEFAULT 0"], ["evidence_snippet", "TEXT"], ["counter_thesis", "TEXT"], ["thesis_id", "INTEGER"],
  ] as const) ensureColumn(db, "ticker_mentions", column, definition);

  db.exec(`CREATE TABLE IF NOT EXISTS transcript_segments (
    id INTEGER PRIMARY KEY AUTOINCREMENT, research_run_id INTEGER NOT NULL, segment_uid TEXT NOT NULL, segment_index INTEGER NOT NULL,
    start_offset INTEGER NOT NULL, end_offset INTEGER NOT NULL, text TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending', error_message TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (research_run_id) REFERENCES research_runs(id) ON DELETE CASCADE, UNIQUE(research_run_id, segment_uid)
  );
  CREATE TABLE IF NOT EXISTS evidence_quotes (
    id INTEGER PRIMARY KEY AUTOINCREMENT, research_run_id INTEGER NOT NULL, segment_id INTEGER NOT NULL, claim_id INTEGER,
    quote_uid TEXT NOT NULL, quote_text TEXT NOT NULL, start_offset INTEGER NOT NULL, end_offset INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')), FOREIGN KEY (research_run_id) REFERENCES research_runs(id) ON DELETE CASCADE,
    FOREIGN KEY (segment_id) REFERENCES transcript_segments(id) ON DELETE CASCADE, UNIQUE(research_run_id, quote_uid)
  );
  CREATE TABLE IF NOT EXISTS research_claims (
    id INTEGER PRIMARY KEY AUTOINCREMENT, research_run_id INTEGER NOT NULL, claim_uid TEXT NOT NULL, claim TEXT NOT NULL, claim_type TEXT NOT NULL,
    importance INTEGER NOT NULL, confidence TEXT NOT NULL, segment_id INTEGER NOT NULL, evidence_quote_id INTEGER, entities TEXT, value_chain_layers TEXT,
    FOREIGN KEY (research_run_id) REFERENCES research_runs(id) ON DELETE CASCADE, FOREIGN KEY (segment_id) REFERENCES transcript_segments(id) ON DELETE CASCADE,
    FOREIGN KEY (evidence_quote_id) REFERENCES evidence_quotes(id) ON DELETE SET NULL, UNIQUE(research_run_id, claim_uid)
  );
  CREATE TABLE IF NOT EXISTS research_theses (
    id INTEGER PRIMARY KEY AUTOINCREMENT, research_run_id INTEGER NOT NULL, thesis_uid TEXT NOT NULL, title TEXT NOT NULL, summary TEXT NOT NULL,
    technical_mechanism TEXT, value_chain_layers TEXT, magnitude_claim TEXT, catalysts TEXT, risks TEXT, confidence TEXT NOT NULL, sort_order INTEGER NOT NULL,
    FOREIGN KEY (research_run_id) REFERENCES research_runs(id) ON DELETE CASCADE, UNIQUE(research_run_id, thesis_uid)
  );
  CREATE TABLE IF NOT EXISTS thesis_claims (
    thesis_id INTEGER NOT NULL, claim_id INTEGER NOT NULL, PRIMARY KEY (thesis_id, claim_id),
    FOREIGN KEY (thesis_id) REFERENCES research_theses(id) ON DELETE CASCADE, FOREIGN KEY (claim_id) REFERENCES research_claims(id) ON DELETE CASCADE
  );
  CREATE TABLE IF NOT EXISTS web_sources (
    id INTEGER PRIMARY KEY AUTOINCREMENT, research_run_id INTEGER NOT NULL, thesis_id INTEGER, url TEXT NOT NULL, title TEXT, publisher TEXT, snippet TEXT,
    source_type TEXT, credibility TEXT NOT NULL DEFAULT 'medium', created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (research_run_id) REFERENCES research_runs(id) ON DELETE CASCADE, FOREIGN KEY (thesis_id) REFERENCES research_theses(id) ON DELETE CASCADE,
    UNIQUE(research_run_id, thesis_id, url)
  );
  CREATE TABLE IF NOT EXISTS ticker_claims (
    ticker_mention_id INTEGER NOT NULL, claim_id INTEGER NOT NULL, PRIMARY KEY (ticker_mention_id, claim_id),
    FOREIGN KEY (ticker_mention_id) REFERENCES ticker_mentions(id) ON DELETE CASCADE, FOREIGN KEY (claim_id) REFERENCES research_claims(id) ON DELETE CASCADE
  );
  CREATE TABLE IF NOT EXISTS ticker_theses (
    ticker_mention_id INTEGER NOT NULL, thesis_id INTEGER NOT NULL, PRIMARY KEY (ticker_mention_id, thesis_id),
    FOREIGN KEY (ticker_mention_id) REFERENCES ticker_mentions(id) ON DELETE CASCADE, FOREIGN KEY (thesis_id) REFERENCES research_theses(id) ON DELETE CASCADE
  );
  CREATE TABLE IF NOT EXISTS ticker_web_sources (
    ticker_mention_id INTEGER NOT NULL, web_source_id INTEGER NOT NULL, PRIMARY KEY (ticker_mention_id, web_source_id),
    FOREIGN KEY (ticker_mention_id) REFERENCES ticker_mentions(id) ON DELETE CASCADE, FOREIGN KEY (web_source_id) REFERENCES web_sources(id) ON DELETE CASCADE
  );
  CREATE TABLE IF NOT EXISTS research_sections (
    id INTEGER PRIMARY KEY AUTOINCREMENT, research_run_id INTEGER NOT NULL, thesis_id INTEGER, section_slug TEXT NOT NULL, title TEXT NOT NULL,
    body_markdown TEXT NOT NULL, sort_order INTEGER NOT NULL, FOREIGN KEY (research_run_id) REFERENCES research_runs(id) ON DELETE CASCADE,
    FOREIGN KEY (thesis_id) REFERENCES research_theses(id) ON DELETE CASCADE, UNIQUE(research_run_id, section_slug)
  );
  CREATE TABLE IF NOT EXISTS company_dossiers (
    id INTEGER PRIMARY KEY AUTOINCREMENT, research_run_id INTEGER NOT NULL, thesis_id INTEGER, symbol TEXT NOT NULL, company_name TEXT NOT NULL,
    body_markdown TEXT NOT NULL, catalysts TEXT, risks TEXT, falsifiers TEXT, valuation_questions TEXT,
    FOREIGN KEY (research_run_id) REFERENCES research_runs(id) ON DELETE CASCADE, FOREIGN KEY (thesis_id) REFERENCES research_theses(id) ON DELETE CASCADE,
    UNIQUE(research_run_id, thesis_id, symbol)
  );
  CREATE INDEX IF NOT EXISTS idx_research_runs_source_status ON research_runs(source_id, status, id DESC);
  CREATE INDEX IF NOT EXISTS idx_segments_run_status ON transcript_segments(research_run_id, status, segment_index);
  CREATE INDEX IF NOT EXISTS idx_claims_run ON research_claims(research_run_id);`);

  // Quote anchoring degrades gracefully instead of discarding evidence, so the
  // strength of each anchor and the per-segment yield are recorded explicitly.
  ensureColumn(db, "evidence_quotes", "match_kind", "TEXT NOT NULL DEFAULT 'exact'");
  ensureColumn(db, "transcript_segments", "claims_extracted", "INTEGER NOT NULL DEFAULT 0");
  ensureColumn(db, "transcript_segments", "claims_unverified", "INTEGER NOT NULL DEFAULT 0");
}

export function getSource(id: number): Source | undefined { return getDb().prepare("SELECT * FROM sources WHERE id = ?").get(id) as Source | undefined; }
export function createSource(input: { title: string; url: string; show_host?: string; notes?: string; transcript: string }): Source {
  const result = getDb().prepare("INSERT INTO sources (title, url, show_host, notes, transcript) VALUES (@title, @url, @show_host, @notes, @transcript)").run({ title: input.title.trim(), url: input.url.trim(), show_host: input.show_host?.trim() || null, notes: input.notes?.trim() || null, transcript: input.transcript.trim() });
  return getSource(Number(result.lastInsertRowid))!;
}
export function updateSourceStatus(id: number, status: SourceStatus, errorMessage: string | null = null) { getDb().prepare("UPDATE sources SET status = ?, error_message = ?, updated_at = datetime('now') WHERE id = ?").run(status, errorMessage, id); }
export function deleteSource(id: number) { getDb().prepare("DELETE FROM sources WHERE id = ?").run(id); }

export function listSources(): SourceListItem[] {
  return getDb().prepare(`SELECT s.*, (SELECT rr.summary FROM research_runs rr WHERE rr.source_id = s.id AND rr.status = 'completed' ORDER BY rr.id DESC LIMIT 1) AS research_summary, COALESCE((SELECT COUNT(DISTINCT tm.ticker_id) FROM ticker_mentions tm WHERE tm.research_run_id = (SELECT rr.id FROM research_runs rr WHERE rr.source_id = s.id AND rr.status = 'completed' ORDER BY rr.id DESC LIMIT 1)), 0) AS ticker_count FROM sources s ORDER BY s.updated_at DESC`).all() as SourceListItem[];
}

function latestCompletedRun(sourceId: number) { return getDb().prepare("SELECT * FROM research_runs WHERE source_id = ? AND status = 'completed' ORDER BY id DESC LIMIT 1").get(sourceId) as ResearchRun | undefined; }
export function getActiveResearchRun(sourceId: number) {
  const latest = getDb().prepare("SELECT * FROM research_runs WHERE source_id = ? ORDER BY id DESC LIMIT 1").get(sourceId) as ResearchRun | undefined;
  return latest && latest.status !== "completed" ? latest : undefined;
}

export function getResearchRunStatus(runId: number): ResearchRunStatusDetail | null {
  const db = getDb(); const run = db.prepare("SELECT * FROM research_runs WHERE id = ?").get(runId) as ResearchRun | undefined;
  if (!run) return null;
  const stats = db.prepare(`SELECT
    (SELECT COUNT(*) FROM transcript_segments WHERE research_run_id = ?) AS segment_total,
    (SELECT COUNT(*) FROM transcript_segments WHERE research_run_id = ? AND status = 'processed') AS segment_processed,
    (SELECT COUNT(*) FROM research_claims WHERE research_run_id = ?) AS claim_count,
    (SELECT COUNT(*) FROM research_theses WHERE research_run_id = ?) AS thesis_count,
    (SELECT COUNT(*) FROM ticker_mentions WHERE research_run_id = ?) AS ticker_count,
    (SELECT COUNT(*) FROM web_sources WHERE research_run_id = ?) AS web_source_count`).get(runId, runId, runId, runId, runId, runId) as Omit<ResearchRunStatusDetail, keyof ResearchRun>;
  return {
    ...run,
    status: run.status ?? "completed",
    current_stage: run.current_stage ?? "completed",
    progress_current: run.progress_current ?? 0,
    progress_total: run.progress_total ?? 0,
    coverage_pct: run.coverage_pct ?? 0,
    input_tokens: run.input_tokens ?? 0,
    output_tokens: run.output_tokens ?? 0,
    estimated_cost_usd: run.estimated_cost_usd ?? 0,
    ...stats,
  };
}

export function createResearchRun(sourceId: number, model: string, segments: SegmentInput[]) {
  const db = getDb();
  const run = db.transaction(() => {
    const inserted = db.prepare(`INSERT INTO research_runs (source_id, model, summary, status, current_stage, progress_total, started_at) VALUES (?, ?, '', 'queued', 'queued', ?, datetime('now'))`).run(sourceId, model, segments.length);
    const runId = Number(inserted.lastInsertRowid);
    const insertSegment = db.prepare("INSERT INTO transcript_segments (research_run_id, segment_uid, segment_index, start_offset, end_offset, text) VALUES (?, ?, ?, ?, ?, ?)");
    for (const segment of segments) insertSegment.run(runId, segment.uid, segment.index, segment.startOffset, segment.endOffset, segment.text);
    updateSourceStatus(sourceId, "researching");
    return runId;
  });
  return getResearchRunStatus(run())!;
}

export function setRunStage(runId: number, stage: ResearchStage, progressCurrent?: number, progressTotal?: number) {
  const status = stage === "completed" ? "completed" : stage === "error" ? "error" : "running";
  getDb().prepare(`UPDATE research_runs SET status = ?, current_stage = ?, progress_current = COALESCE(?, progress_current), progress_total = COALESCE(?, progress_total), updated_at = datetime('now'), completed_at = CASE WHEN ? = 'completed' THEN datetime('now') ELSE completed_at END WHERE id = ?`).run(status, stage, progressCurrent ?? null, progressTotal ?? null, stage, runId);
}
export function addRunUsage(runId: number, usage: Usage) {
  getDb().prepare("UPDATE research_runs SET input_tokens = input_tokens + ?, output_tokens = output_tokens + ?, estimated_cost_usd = estimated_cost_usd + ?, updated_at = datetime('now') WHERE id = ?").run(usage.inputTokens, usage.outputTokens, estimateCostUsd(usage), runId);
}
export function failResearchRun(runId: number, message: string) {
  const run = getResearchRunStatus(runId); if (!run) return;
  getDb().prepare("UPDATE research_runs SET status = 'error', error_message = ?, updated_at = datetime('now') WHERE id = ?").run(message, runId);
  updateSourceStatus(run.source_id, "error", message);
}
export function retryResearchRun(runId: number): ResearchRunStatusDetail | null {
  const run = getResearchRunStatus(runId); if (!run || run.status !== "error") return run;
  const stage = run.current_stage === "error"
    ? run.segment_processed < run.segment_total ? "segment_extraction"
      : run.thesis_count === 0 ? "thesis_building"
        : run.web_source_count < run.thesis_count ? "web_verification"
          : run.ticker_count === 0 ? "equity_mapping"
            : getResearchSections(run.id).length < run.thesis_count ? "report_writing" : "audit"
    : run.current_stage;
  getDb().prepare("UPDATE research_runs SET status = 'running', current_stage = ?, error_message = NULL, updated_at = datetime('now') WHERE id = ?").run(stage, runId);
  updateSourceStatus(run.source_id, "researching");
  return getResearchRunStatus(runId);
}
export function getPendingSegments(runId: number, limit: number): TranscriptSegment[] { return getDb().prepare("SELECT * FROM transcript_segments WHERE research_run_id = ? AND status = 'pending' ORDER BY segment_index LIMIT ?").all(runId, limit) as TranscriptSegment[]; }
export function getSegments(runId: number): TranscriptSegment[] { return getDb().prepare("SELECT * FROM transcript_segments WHERE research_run_id = ? ORDER BY segment_index").all(runId) as TranscriptSegment[]; }

export function saveSegmentClaims(runId: number, segment: TranscriptSegment, extracted: ExtractedClaim[], anchors: QuoteAnchor[]) {
  const db = getDb(); db.transaction(() => {
    const quote = db.prepare("INSERT INTO evidence_quotes (research_run_id, segment_id, quote_uid, quote_text, start_offset, end_offset, match_kind) VALUES (?, ?, ?, ?, ?, ?, ?)");
    const claim = db.prepare("INSERT INTO research_claims (research_run_id, claim_uid, claim, claim_type, importance, confidence, segment_id, evidence_quote_id, entities, value_chain_layers) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
    const attach = db.prepare("UPDATE evidence_quotes SET claim_id = ? WHERE id = ?");
    let unverified = 0;
    extracted.forEach((item, index) => {
      // A quote we could not anchor is still evidence; it is kept and flagged
      // rather than dropped, which used to lose most of a run in silence.
      const anchor = anchors[index] ?? { startOffset: segment.start_offset, endOffset: segment.end_offset, matchKind: "unverified" as const };
      if (anchor.matchKind === "unverified") unverified += 1;
      const quoteRow = quote.run(runId, segment.id, `quote-${segment.segment_uid}-${index + 1}`, item.quote.trim(), anchor.startOffset, anchor.endOffset, anchor.matchKind);
      const claimRow = claim.run(runId, `claim-${segment.segment_uid}-${index + 1}`, item.claim.trim(), item.claimType, item.importance, item.confidence, segment.id, Number(quoteRow.lastInsertRowid), JSON.stringify(item.entities), JSON.stringify(item.valueChainLayers));
      attach.run(Number(claimRow.lastInsertRowid), Number(quoteRow.lastInsertRowid));
    });
    db.prepare("UPDATE transcript_segments SET status = 'processed', error_message = ?, claims_extracted = ?, claims_unverified = ?, updated_at = datetime('now') WHERE id = ?")
      .run(unverified ? `${unverified}/${extracted.length} quotes could not be anchored to the transcript.` : null, extracted.length, unverified, segment.id);
  })();
}

export function getClaimsForRun(runId: number): EvidenceClaim[] {
  return getDb().prepare(`SELECT rc.*, eq.quote_text, eq.start_offset, eq.end_offset, eq.match_kind FROM research_claims rc JOIN evidence_quotes eq ON eq.id = rc.evidence_quote_id WHERE rc.research_run_id = ? ORDER BY rc.id`).all(runId) as EvidenceClaim[];
}

export function replaceTheses(runId: number, theses: ThesisDraft[]) {
  const db = getDb(); db.transaction(() => {
    db.prepare("DELETE FROM research_theses WHERE research_run_id = ?").run(runId);
    const claims = db.prepare("SELECT id, claim_uid FROM research_claims WHERE research_run_id = ?").all(runId) as Array<{ id: number; claim_uid: string }>;
    const claimMap = new Map(claims.map((claim) => [claim.claim_uid, claim.id]));
    const insert = db.prepare("INSERT INTO research_theses (research_run_id, thesis_uid, title, summary, technical_mechanism, value_chain_layers, magnitude_claim, catalysts, risks, confidence, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
    const link = db.prepare("INSERT OR IGNORE INTO thesis_claims (thesis_id, claim_id) VALUES (?, ?)");
    theses.forEach((thesis, index) => { const row = insert.run(runId, `thesis-${index + 1}`, thesis.title, thesis.summary, thesis.technicalMechanism, JSON.stringify(thesis.valueChainLayers), thesis.magnitudeClaim, JSON.stringify(thesis.catalysts), JSON.stringify(thesis.risks), thesis.confidence, index); const thesisId = Number(row.lastInsertRowid); thesis.claimUids.forEach((uid) => { const claimId = claimMap.get(uid); if (claimId) link.run(thesisId, claimId); }); });
  })();
}
export function getThesesForRun(runId: number): ResearchThesis[] { return getDb().prepare("SELECT * FROM research_theses WHERE research_run_id = ? ORDER BY sort_order").all(runId) as ResearchThesis[]; }
export function getThesisEvidence(thesisId: number) { return getDb().prepare(`SELECT rc.*, eq.quote_text, eq.start_offset, eq.end_offset, eq.match_kind FROM thesis_claims tc JOIN research_claims rc ON rc.id = tc.claim_id JOIN evidence_quotes eq ON eq.id = rc.evidence_quote_id WHERE tc.thesis_id = ? ORDER BY rc.importance DESC, rc.id`).all(thesisId) as EvidenceClaim[]; }
export function replaceWebSources(runId: number, thesisId: number, sources: Array<{ url: string; title: string | null; publisher: string | null; snippet: string | null; sourceType: string | null; credibility: string }>) { const db = getDb(); db.transaction(() => { db.prepare("DELETE FROM web_sources WHERE research_run_id = ? AND thesis_id = ?").run(runId, thesisId); const insert = db.prepare("INSERT OR IGNORE INTO web_sources (research_run_id, thesis_id, url, title, publisher, snippet, source_type, credibility) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"); sources.forEach((source) => insert.run(runId, thesisId, source.url, source.title, source.publisher, source.snippet, source.sourceType, source.credibility)); })(); }
export function getWebSources(runId: number, thesisId?: number): WebSource[] { return thesisId ? getDb().prepare("SELECT * FROM web_sources WHERE research_run_id = ? AND thesis_id = ? ORDER BY id").all(runId, thesisId) as WebSource[] : getDb().prepare("SELECT * FROM web_sources WHERE research_run_id = ? ORDER BY id").all(runId) as WebSource[]; }

export function saveThesisEquities(runId: number, thesis: ResearchThesis, equities: EquityDraft[]) {
  const db = getDb(); db.transaction(() => {
    const upsertTicker = db.prepare("INSERT INTO tickers (symbol, company_name) VALUES (?, ?) ON CONFLICT(symbol) DO UPDATE SET company_name = excluded.company_name");
    const tickerId = db.prepare("SELECT id FROM tickers WHERE symbol = ?");
    const insertMention = db.prepare(`INSERT INTO ticker_mentions (research_run_id, ticker_id, thesis_id, confidence, rationale, mention_type, themes, value_chain_layer, thesis_link, time_horizon, exchange, country, exposure_score, purity_score, asymmetry_score, mega_cap, evidence_snippet, counter_thesis) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(research_run_id, ticker_id) DO UPDATE SET thesis_id = excluded.thesis_id, confidence = excluded.confidence, rationale = excluded.rationale, mention_type = excluded.mention_type, value_chain_layer = excluded.value_chain_layer, thesis_link = excluded.thesis_link, time_horizon = excluded.time_horizon, exchange = excluded.exchange, country = excluded.country, exposure_score = excluded.exposure_score, purity_score = excluded.purity_score, asymmetry_score = excluded.asymmetry_score, mega_cap = excluded.mega_cap, counter_thesis = excluded.counter_thesis`);
    const claimMap = new Map((db.prepare("SELECT id, claim_uid FROM research_claims WHERE research_run_id = ?").all(runId) as Array<{ id: number; claim_uid: string }>).map((claim) => [claim.claim_uid, claim.id]));
    const sourceMap = new Map((getWebSources(runId, thesis.id)).map((source) => [source.url, source.id]));
    const linkClaim = db.prepare("INSERT OR IGNORE INTO ticker_claims (ticker_mention_id, claim_id) VALUES (?, ?)"); const linkThesis = db.prepare("INSERT OR IGNORE INTO ticker_theses (ticker_mention_id, thesis_id) VALUES (?, ?)"); const linkSource = db.prepare("INSERT OR IGNORE INTO ticker_web_sources (ticker_mention_id, web_source_id) VALUES (?, ?)");
    const dossier = db.prepare("INSERT INTO company_dossiers (research_run_id, thesis_id, symbol, company_name, body_markdown, catalysts, risks, falsifiers, valuation_questions) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(research_run_id, thesis_id, symbol) DO UPDATE SET body_markdown = excluded.body_markdown, catalysts = excluded.catalysts, risks = excluded.risks, falsifiers = excluded.falsifiers, valuation_questions = excluded.valuation_questions");
    equities.forEach((equity) => { const symbol = equity.symbol.toUpperCase().replace(/[^A-Z0-9.\-]/g, ""); if (!symbol) return; upsertTicker.run(symbol, equity.companyName); const id = (tickerId.get(symbol) as { id: number }).id; insertMention.run(runId, id, thesis.id, equity.confidence, equity.rationale, equity.mentionType, thesis.title, equity.valueChainLayer, thesis.title, equity.timeHorizon, equity.exchange, equity.country, equity.exposureScore, equity.purityScore, equity.asymmetryScore, ["NVDA", "MSFT", "GOOGL", "GOOG", "AMZN", "META", "TSM", "TSMC", "AVGO"].includes(symbol) ? 1 : 0, null, equity.falsifiers.join("; ")); const mentionId = (db.prepare("SELECT id FROM ticker_mentions WHERE research_run_id = ? AND ticker_id = ?").get(runId, id) as { id: number }).id; linkThesis.run(mentionId, thesis.id); equity.claimUids.forEach((uid) => { const id = claimMap.get(uid); if (id) linkClaim.run(mentionId, id); }); equity.webSourceUrls.forEach((url) => { const id = sourceMap.get(url); if (id) linkSource.run(mentionId, id); }); dossier.run(runId, thesis.id, symbol, equity.companyName, `${equity.rationale}\n\n## Catalysts\n${equity.catalysts.map((item) => `- ${item}`).join("\n")}\n\n## Risks\n${equity.risks.map((item) => `- ${item}`).join("\n")}\n\n## Falsifiers\n${equity.falsifiers.map((item) => `- ${item}`).join("\n")}\n\n## Valuation questions\n${equity.valuationQuestions.map((item) => `- ${item}`).join("\n")}`, JSON.stringify(equity.catalysts), JSON.stringify(equity.risks), JSON.stringify(equity.falsifiers), JSON.stringify(equity.valuationQuestions)); });
  })();
}
export function saveReportSection(runId: number, thesisId: number | null, slug: string, title: string, body: string, order: number) { getDb().prepare("INSERT INTO research_sections (research_run_id, thesis_id, section_slug, title, body_markdown, sort_order) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(research_run_id, section_slug) DO UPDATE SET title = excluded.title, body_markdown = excluded.body_markdown, sort_order = excluded.sort_order").run(runId, thesisId, slug, title, body, order); }
export function getResearchSections(runId: number): ResearchSection[] { return getDb().prepare("SELECT * FROM research_sections WHERE research_run_id = ? ORDER BY sort_order").all(runId) as ResearchSection[]; }
export function completeResearchRun(runId: number, summary: string, qualityNotes: string[], coverage: number) { const run = getResearchRunStatus(runId); if (!run) return; getDb().prepare("UPDATE research_runs SET status = 'completed', current_stage = 'completed', summary = ?, quality_notes = ?, coverage_pct = ?, completed_at = datetime('now'), updated_at = datetime('now'), error_message = NULL WHERE id = ?").run(summary, JSON.stringify(qualityNotes), coverage, runId); updateSourceStatus(run.source_id, "researched"); }

export function getRunTickers(runId: number): SourceDetail["tickers"] {
  return getDb().prepare(`SELECT tm.id AS mention_id, t.symbol, t.company_name, tm.confidence, tm.rationale, tm.mention_type, tm.themes, tm.value_chain_layer, tm.thesis_link, tm.time_horizon, tm.exchange, tm.country, tm.exposure_score, tm.purity_score, tm.asymmetry_score, tm.mega_cap, tm.evidence_snippet, tm.counter_thesis, tm.thesis_id, CASE WHEN EXISTS (SELECT 1 FROM ticker_claims tc WHERE tc.ticker_mention_id = tm.id) AND EXISTS (SELECT 1 FROM ticker_web_sources tw WHERE tw.ticker_mention_id = tm.id) THEN 1 ELSE 0 END AS grounded FROM ticker_mentions tm JOIN tickers t ON t.id = tm.ticker_id WHERE tm.research_run_id = ? ORDER BY tm.asymmetry_score DESC, tm.purity_score DESC, tm.exposure_score DESC, CASE tm.mention_type WHEN 'second_order' THEN 1 WHEN 'related' THEN 2 ELSE 3 END, t.symbol`).all(runId) as SourceDetail["tickers"];
}

export function getSourceDetail(id: number): SourceDetail | null {
  const source = getSource(id); if (!source) return null; const db = getDb(); const research = latestCompletedRun(id); const active = getActiveResearchRun(id); const activeDetail = active ? getResearchRunStatus(active.id) : null;
  if (!research) return { ...source, research: null, themes: [], market_theses: [], claims: [], tickers: [], active_run: activeDetail };
  const themes = db.prepare("SELECT * FROM themes WHERE research_run_id = ? ORDER BY id").all(research.id) as Theme[];
  const oldTheses = db.prepare("SELECT * FROM market_theses WHERE research_run_id = ? ORDER BY id").all(research.id) as MarketThesis[];
  const oldClaims = db.prepare("SELECT * FROM claims WHERE research_run_id = ? ORDER BY id").all(research.id) as Claim[];
  const tickers = getRunTickers(research.id);
  return { ...source, research, themes, market_theses: oldTheses, claims: oldClaims, tickers, active_run: activeDetail };
}

export function getSourceResearchRun(sourceId: number) { return latestCompletedRun(sourceId) ?? getActiveResearchRun(sourceId) ?? null; }
export function getThesisDetail(sourceId: number, thesisId: number) { const run = getSourceResearchRun(sourceId); if (!run) return null; const thesis = getDb().prepare("SELECT * FROM research_theses WHERE id = ? AND research_run_id = ?").get(thesisId, run.id) as ResearchThesis | undefined; if (!thesis) return null; const webSources = getWebSources(run.id, thesis.id); const tickerIds = new Set((getDb().prepare("SELECT ticker_mention_id FROM ticker_theses WHERE thesis_id = ?").all(thesis.id) as Array<{ ticker_mention_id: number }>).map((row) => row.ticker_mention_id)); const tickers = getRunTickers(run.id).filter((ticker) => ticker.thesis_id === thesis.id || tickerIds.has(ticker.mention_id ?? -1)); return { run, thesis, evidence: getThesisEvidence(thesis.id), webSources, tickers }; }
export function getSourceClaims(sourceId: number) { const run = getSourceResearchRun(sourceId); if (!run) return null; return { run, claims: getClaimsForRun(run.id), webSources: getWebSources(run.id), segments: getSegments(run.id) }; }
export function getCompanyDossier(sourceId: number, symbol: string): CompanyDossier | null { const run = getSourceResearchRun(sourceId); if (!run) return null; return getDb().prepare("SELECT * FROM company_dossiers WHERE research_run_id = ? AND symbol = ? ORDER BY id LIMIT 1").get(run.id, symbol.toUpperCase()) as CompanyDossier | null; }

export function listTickers(): TickerListItem[] { return getDb().prepare(`SELECT t.symbol, t.company_name, COUNT(tm.id) AS mention_count, COUNT(DISTINCT rr.source_id) AS source_count, SUM(CASE WHEN tm.mention_type = 'second_order' THEN 1 ELSE 0 END) AS second_order_count, ROUND(AVG(tm.exposure_score), 1) AS avg_exposure_score, ROUND(AVG(tm.purity_score), 1) AS avg_purity_score, ROUND(AVG(tm.asymmetry_score), 1) AS avg_asymmetry_score, MAX(rr.created_at) AS latest_mention_at FROM tickers t JOIN ticker_mentions tm ON tm.ticker_id = t.id JOIN research_runs rr ON rr.id = tm.research_run_id GROUP BY t.id ORDER BY source_count DESC, mention_count DESC, t.symbol`).all() as TickerListItem[]; }
export function getTickerDetail(symbol: string): TickerDetail | null { const db = getDb(); const ticker = db.prepare("SELECT * FROM tickers WHERE symbol = ?").get(symbol.toUpperCase()) as { symbol: string; company_name: string } | undefined; if (!ticker) return null; const mentions = db.prepare(`SELECT s.id AS source_id, s.title AS source_title, s.url AS source_url, tm.confidence, tm.rationale, tm.mention_type, tm.themes, tm.value_chain_layer, tm.thesis_link, tm.time_horizon, tm.exchange, tm.country, tm.exposure_score, tm.purity_score, tm.asymmetry_score, tm.mega_cap, tm.evidence_snippet, tm.counter_thesis, rr.created_at AS researched_at FROM ticker_mentions tm JOIN tickers t ON t.id = tm.ticker_id JOIN research_runs rr ON rr.id = tm.research_run_id JOIN sources s ON s.id = rr.source_id WHERE t.symbol = ? ORDER BY tm.asymmetry_score DESC, rr.created_at DESC`).all(ticker.symbol) as TickerDetail["mentions"]; return { ...ticker, mentions }; }
