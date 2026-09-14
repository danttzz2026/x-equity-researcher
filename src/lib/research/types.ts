import type { Confidence, MentionType } from "@/lib/types";

export interface SegmentInput {
  uid: string;
  index: number;
  startOffset: number;
  endOffset: number;
  text: string;
}

export interface ExtractedClaim {
  claim: string;
  claimType: "technical" | "magnitude" | "causal" | "bottleneck" | "market_structure";
  importance: number;
  confidence: Confidence;
  quote: string;
  entities: string[];
  valueChainLayers: string[];
}

export interface ExtractedSegment {
  claims: ExtractedClaim[];
}

export interface ThesisDraft {
  title: string;
  summary: string;
  technicalMechanism: string | null;
  valueChainLayers: string[];
  magnitudeClaim: string | null;
  catalysts: string[];
  risks: string[];
  confidence: Confidence;
  claimUids: string[];
}

export interface GroundedSourceDraft {
  url: string;
  title: string | null;
  publisher: string | null;
  snippet: string | null;
  sourceType: string | null;
  credibility: Confidence;
}

export interface EquityDraft {
  symbol: string;
  companyName: string;
  exchange: string | null;
  country: string | null;
  confidence: Confidence;
  mentionType: MentionType;
  valueChainLayer: string | null;
  timeHorizon: string | null;
  exposureScore: number;
  purityScore: number;
  asymmetryScore: number;
  rationale: string;
  catalysts: string[];
  risks: string[];
  falsifiers: string[];
  valuationQuestions: string[];
  claimUids: string[];
  webSourceUrls: string[];
}

export interface Usage {
  inputTokens: number;
  outputTokens: number;
}
