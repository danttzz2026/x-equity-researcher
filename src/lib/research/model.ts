import { GoogleGenAI } from "@google/genai";
import { z } from "zod";
import type { GroundedSourceDraft, Usage } from "./types";

export const RESEARCH_MODEL =
  process.env.GEMINI_MODEL?.trim() || "gemini-3.5-flash";

const MAX_ATTEMPTS = 3;
const MAX_OUTPUT_TOKEN_CEILING = 32_768;

/**
 * This is a thinking model and maxOutputTokens covers thinking *and* the
 * answer, so unbudgeted reasoning starves the response: a 7k cap was observed
 * spending 6,718 tokens on thoughts and 265 on the answer, truncating the JSON
 * mid-string. Callers size the answer; thinking is capped on top of it.
 */
const DEFAULT_THINKING_BUDGET = 2_048;

/** Surfaces the offending fields instead of dumping a raw Zod issue array. */
export class SchemaValidationError extends Error {
  constructor(error: z.ZodError) {
    const detail = error.issues
      .slice(0, 4)
      .map((issue) => `${issue.path.join(".") || "response"}: ${issue.message}`)
      .join("; ");
    const more = error.issues.length > 4 ? ` (+${error.issues.length - 4} more)` : "";
    super(`The model returned a response that did not match the expected shape — ${detail}${more}`);
    this.name = "SchemaValidationError";
  }
}

/**
 * The model ran out of output budget mid-JSON. Retrying at the same size hits
 * the same wall, so the caller escalates the budget instead.
 */
export class TruncatedResponseError extends Error {
  constructor(readonly budget: number, thoughtTokens?: number) {
    const thoughts = thoughtTokens ? ` (${thoughtTokens} tokens went to thinking)` : "";
    super(`The model hit its ${budget}-token answer limit before completing the JSON response${thoughts}.`);
    this.name = "TruncatedResponseError";
  }
}

function isRetryableProviderError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return !/\b(400|401|403|429)\b|RESOURCE_EXHAUSTED|quota|api key|invalid argument/i.test(message);
}

export function hasResearchApiKey() {
  return Boolean(process.env.GEMINI_API_KEY?.trim());
}

function getClient() {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is missing. Add it to .env.local and restart the server.");
  }
  return new GoogleGenAI({ apiKey });
}

function parseResponseText(text: string | undefined): unknown {
  if (!text) throw new Error("Gemini returned an empty response.");
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch (error) {
    // Only a fence wrapping the whole response is packaging. Searching anywhere
    // for ``` would grab a code block inside a markdown field — an ASCII
    // value-chain diagram in a report chapter — and parse the diagram instead.
    const fenced = trimmed.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?```$/i);
    if (!fenced) throw error;
    return JSON.parse(fenced[1].trim());
  }
}

export const parseResponseTextForTest = parseResponseText;

function usageFrom(response: { usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number } }): Usage {
  return {
    inputTokens: response.usageMetadata?.promptTokenCount ?? 0,
    outputTokens: response.usageMetadata?.candidatesTokenCount ?? 0,
  };
}

function groundedSources(response: { candidates?: Array<{ groundingMetadata?: { groundingChunks?: Array<{ web?: { uri?: string; title?: string } }> } }> }): GroundedSourceDraft[] {
  const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks ?? [];
  const seen = new Set<string>();
  return chunks.flatMap((chunk) => {
    const url = chunk.web?.uri;
    if (!url || seen.has(url)) return [];
    seen.add(url);
    return [{
      url,
      title: chunk.web?.title ?? null,
      publisher: null,
      snippet: null,
      sourceType: "google_search",
      credibility: "medium" as const,
    }];
  });
}

export async function generateStructured<T>(input: {
  prompt: string;
  schema: z.ZodType<T>;
  jsonSchema: object;
  useGoogleSearch?: boolean;
  /** Token space for the answer itself; the thinking budget is added on top. */
  maxOutputTokens?: number;
  thinkingBudget?: number;
}): Promise<{ data: T; usage: Usage; sources: GroundedSourceDraft[] }> {
  const ai = getClient();
  let lastError: unknown;
  const thinkingBudget = input.thinkingBudget ?? DEFAULT_THINKING_BUDGET;
  let budget = input.maxOutputTokens ?? 8_192;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      const response = await ai.models.generateContent({
        model: RESEARCH_MODEL,
        contents: input.prompt,
        config: {
          temperature: 0.2,
          maxOutputTokens: budget + thinkingBudget,
          thinkingConfig: { thinkingBudget },
          responseMimeType: "application/json",
          responseJsonSchema: input.jsonSchema,
          ...(input.useGoogleSearch ? { tools: [{ googleSearch: {} }] } : {}),
        },
      });
      // Check truncation before parsing: a cut-off response fails as a cryptic
      // "Unterminated string in JSON" that hides the real cause.
      if (response.candidates?.[0]?.finishReason === "MAX_TOKENS") {
        throw new TruncatedResponseError(budget, response.usageMetadata?.thoughtsTokenCount);
      }
      const parsed = input.schema.safeParse(parseResponseText(response.text));
      if (!parsed.success) {
        // A schema mismatch is a prompt/contract problem, not a transient one;
        // re-rolling it just burns the budget on the same failure.
        throw new SchemaValidationError(parsed.error);
      }
      return {
        data: parsed.data,
        usage: usageFrom(response),
        sources: groundedSources(response),
      };
    } catch (error) {
      lastError = error;
      if (error instanceof SchemaValidationError) break;
      if (attempt < MAX_ATTEMPTS && error instanceof TruncatedResponseError) {
        // Same prompt at a bigger budget, rather than the same wall three times.
        budget = Math.min(MAX_OUTPUT_TOKEN_CEILING, Math.ceil(budget * 1.75));
        continue;
      }
      if (attempt < MAX_ATTEMPTS && isRetryableProviderError(error)) {
        await new Promise((resolve) => setTimeout(resolve, attempt * 750));
      } else {
        break;
      }
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Gemini request failed.");
}

export function estimateCostUsd(usage: Usage): number {
  // Intentionally conservative local estimate, not a billing-system receipt.
  return Number(((usage.inputTokens * 0.35 + usage.outputTokens * 1.5) / 1_000_000).toFixed(4));
}

export const modelInternalsForTest = { isRetryableProviderError };
