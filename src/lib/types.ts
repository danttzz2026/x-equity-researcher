export type SourceStatus = "draft" | "researching" | "researched" | "error";

export type Confidence = "high" | "medium" | "speculative";

export type MentionType = "explicit" | "second_order" | "related";

export type ResearchStage =
  | "queued"
  | "segment_extraction"
  | "thesis_building"
  | "web_verification"
  | "equity_mapping"
  | "report_writing"
  | "audit"
  | "completed"
  | "error";

export type ResearchRunStatus = "queued" | "running" | "completed" | "error";

export interface Source {
  id: number;
  title: string;
  url: string;
  show_host: string | null;
  notes: string | null;
  transcript: string;
  status: SourceStatus;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

export interface ResearchRun {
  id: number;
  source_id: number;
  model: string;
  summary: string;
  quality_notes: string | null;
  created_at: string;
  status?: ResearchRunStatus;
  current_stage?: ResearchStage;
  progress_current?: number;
  progress_total?: number;
  coverage_pct?: number;
  input_tokens?: number;
  output_tokens?: number;
  estimated_cost_usd?: number;
  error_message?: string | null;
  started_at?: string | null;
  completed_at?: string | null;
  updated_at?: string;
}

export interface ResearchRunStatusDetail extends ResearchRun {
  status: ResearchRunStatus;
  current_stage: ResearchStage;
  progress_current: number;
  progress_total: number;
  coverage_pct: number;
  input_tokens: number;
  output_tokens: number;
  estimated_cost_usd: number;
  segment_total: number;
  segment_processed: number;
  claim_count: number;
  thesis_count: number;
  ticker_count: number;
  web_source_count: number;
}

export interface TranscriptSegment {
  id: number;
  research_run_id: number;
  segment_uid: string;
  segment_index: number;
  start_offset: number;
  end_offset: number;
  text: string;
  status: "pending" | "processed" | "error";
  error_message: string | null;
  claims_extracted: number;
  claims_unverified: number;
}

export interface EvidenceQuote {
  id: number;
  research_run_id: number;
  segment_id: number;
  claim_id: number | null;
  quote_uid: string;
  quote_text: string;
  start_offset: number;
  end_offset: number;
  match_kind: "exact" | "normalized" | "fuzzy" | "unverified";
}

export interface ResearchClaim {
  id: number;
  research_run_id: number;
  claim_uid: string;
  claim: string;
  claim_type: string;
  importance: number;
  confidence: Confidence;
  segment_id: number;
  evidence_quote_id: number | null;
  entities: string | null;
  value_chain_layers: string | null;
}

export interface EvidenceClaim extends ResearchClaim {
  quote_text: string;
  start_offset: number;
  end_offset: number;
  match_kind: EvidenceQuote["match_kind"];
}

export interface ResearchThesis {
  id: number;
  research_run_id: number;
  thesis_uid: string;
  title: string;
  summary: string;
  technical_mechanism: string | null;
  value_chain_layers: string | null;
  magnitude_claim: string | null;
  catalysts: string | null;
  risks: string | null;
  confidence: Confidence;
  sort_order: number;
}

export interface WebSource {
  id: number;
  research_run_id: number;
  thesis_id: number | null;
  url: string;
  title: string | null;
  publisher: string | null;
  snippet: string | null;
  source_type: string | null;
  credibility: Confidence;
}

export interface ResearchSection {
  id: number;
  research_run_id: number;
  thesis_id: number | null;
  section_slug: string;
  title: string;
  body_markdown: string;
  sort_order: number;
}

export interface CompanyDossier {
  id: number;
  research_run_id: number;
  thesis_id: number | null;
  symbol: string;
  company_name: string;
  body_markdown: string;
  catalysts: string | null;
  risks: string | null;
  falsifiers: string | null;
  valuation_questions: string | null;
}

export interface Theme {
  id: number;
  research_run_id: number;
  name: string;
  sector: string | null;
  description: string;
  market_structure: string | null;
}

export interface MarketThesis {
  id: number;
  research_run_id: number;
  name: string;
  magnitude_claim: string | null;
  technical_driver: string | null;
  value_chain: string | null;
  why_it_matters: string;
  time_horizon: string | null;
  evidence_snippets: string | null;
}

export interface Claim {
  id: number;
  research_run_id: number;
  claim: string;
  importance: string | null;
  evidence_snippet: string | null;
}

export interface Ticker {
  id: number;
  symbol: string;
  company_name: string;
  created_at: string;
}

export interface TickerMention {
  id: number;
  research_run_id: number;
  ticker_id: number;
  confidence: Confidence;
  rationale: string;
  mention_type: MentionType;
  themes: string | null;
  value_chain_layer: string | null;
  thesis_link: string | null;
  time_horizon: string | null;
  exchange: string | null;
  country: string | null;
  exposure_score: number;
  purity_score: number;
  asymmetry_score: number;
  mega_cap: number;
  evidence_snippet: string | null;
  counter_thesis: string | null;
}

export interface SourceListItem extends Source {
  research_summary: string | null;
  ticker_count: number;
}

export interface SourceDetailTicker {
  mention_id?: number;
  symbol: string;
  company_name: string;
  confidence: Confidence;
  rationale: string;
  mention_type: MentionType;
  themes: string | null;
  value_chain_layer: string | null;
  thesis_link: string | null;
  time_horizon: string | null;
  exchange: string | null;
  country: string | null;
  exposure_score: number;
  purity_score: number;
  asymmetry_score: number;
  mega_cap: number;
  evidence_snippet: string | null;
  counter_thesis: string | null;
  thesis_id?: number | null;
  grounded?: number;
}

export interface SourceDetail extends Source {
  research: ResearchRun | null;
  themes: Theme[];
  market_theses: MarketThesis[];
  claims: Claim[];
  tickers: SourceDetailTicker[];
  active_run: ResearchRunStatusDetail | null;
}

export interface TickerListItem {
  symbol: string;
  company_name: string;
  mention_count: number;
  source_count: number;
  second_order_count: number;
  avg_exposure_score: number;
  avg_purity_score: number;
  avg_asymmetry_score: number;
  latest_mention_at: string;
}

export interface TickerDetail {
  symbol: string;
  company_name: string;
  mentions: Array<{
    source_id: number;
    source_title: string;
    source_url: string;
    confidence: Confidence;
    rationale: string;
    mention_type: MentionType;
    themes: string | null;
    value_chain_layer: string | null;
    thesis_link: string | null;
    time_horizon: string | null;
    exchange: string | null;
    country: string | null;
    exposure_score: number;
    purity_score: number;
    asymmetry_score: number;
    mega_cap: number;
    evidence_snippet: string | null;
    counter_thesis: string | null;
    researched_at: string;
  }>;
}
