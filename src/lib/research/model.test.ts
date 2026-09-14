import { describe, expect, it } from "vitest";
import { z } from "zod";
import { modelInternalsForTest, parseResponseTextForTest, SchemaValidationError, TruncatedResponseError } from "./model";

describe("Gemini retry policy", () => {
  it("does not amplify quota and credential failures", () => {
    expect(modelInternalsForTest.isRetryableProviderError(new Error("429 RESOURCE_EXHAUSTED quota exceeded"))).toBe(false);
    expect(modelInternalsForTest.isRetryableProviderError(new Error("401 API key invalid"))).toBe(false);
    expect(modelInternalsForTest.isRetryableProviderError(new Error("503 temporarily unavailable"))).toBe(true);
  });
});

describe("failure messages name the actual cause", () => {
  it("reports the offending fields instead of a raw Zod dump", () => {
    const schema = z.object({ theses: z.array(z.object({ claimUids: z.array(z.string()).min(2) })) });
    const result = schema.safeParse({ theses: [{ claimUids: ["a"] }] });
    if (result.success) throw new Error("expected the thin thesis to fail validation");
    const message = new SchemaValidationError(result.error).message;
    expect(message).toContain("theses.0.claimUids");
    // The old UI rendered the raw issue array; the message must not be JSON.
    expect(message).not.toContain('"origin"');
    expect(message).not.toContain("[ {");
  });

  it("names the token limit rather than surfacing a JSON parse error", () => {
    const message = new TruncatedResponseError(4_500).message;
    expect(message).toContain("4500");
    expect(message).toMatch(/answer limit/i);
    expect(message).not.toMatch(/unterminated|JSON at position/i);
  });

  it("points at thinking when thoughts consumed the budget", () => {
    // The real failure: 6,718 tokens of thinking left 265 for the answer.
    expect(new TruncatedResponseError(7_000, 6_718).message).toContain("6718 tokens went to thinking");
  });
});

describe("response parsing", () => {
  const parse = parseResponseTextForTest;

  it("keeps a fenced code block that is part of a markdown field", () => {
    // A report chapter drawing an ASCII value chain used to be mistaken for the
    // JSON wrapper, so the diagram got parsed instead of the response.
    const body = "# Chapter\n\n```\n+--------+\n| Silicon |\n+--------+\n```\n\nAnalysis follows.";
    const parsed = parse(JSON.stringify({ bodyMarkdown: body })) as { bodyMarkdown: string };
    expect(parsed.bodyMarkdown).toBe(body);
    expect(parsed.bodyMarkdown).toContain("+--------+");
  });

  it("still unwraps a response the model wrapped entirely in a fence", () => {
    const parsed = parse('```json\n{"bodyMarkdown":"plain"}\n```') as { bodyMarkdown: string };
    expect(parsed.bodyMarkdown).toBe("plain");
  });

  it("reports the original parse failure for genuinely broken JSON", () => {
    expect(() => parse('{"bodyMarkdown":"unterminated')).toThrow(/JSON/i);
  });
});
