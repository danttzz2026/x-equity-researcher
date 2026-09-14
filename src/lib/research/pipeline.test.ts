import fs from "fs";
import os from "os";
import path from "path";
import { expect, it, vi } from "vitest";

it("shares concurrent requests and resumes only the failed extraction segment", async () => {
  vi.resetModules();
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "research-resume-"));
  process.env.X_EQUITY_DB_PATH = path.join(directory, "test.db");
  const db = await import("../db");
  const extraction = await import("./extract-segment");
  const mock = vi.spyOn(extraction, "extractSegment");
  try {
    const source = db.createSource({ title: "Resume test", url: "https://example.com", transcript: "First segment. Second segment." });
    const run = db.createResearchRun(source.id, "test-model", [
      { uid: "one", index: 0, startOffset: 0, endOffset: 14, text: "First segment." },
      { uid: "two", index: 1, startOffset: 15, endOffset: 30, text: "Second segment." },
    ]);
    db.setRunStage(run.id, "segment_extraction", 0, 2);
    const output = { data: { claims: [] }, usage: { inputTokens: 10, outputTokens: 5 } };
    mock.mockResolvedValueOnce(output).mockRejectedValueOnce(new Error("Temporary outage"));
    const { advanceResearchRun } = await import("./pipeline");
    const [first, second] = await Promise.all([advanceResearchRun(run.id), advanceResearchRun(run.id)]);
    expect(first).toEqual(second);
    expect(first.status).toBe("error");
    expect(mock).toHaveBeenCalledTimes(2);
    expect(db.getPendingSegments(run.id, 10).map((segment) => segment.segment_uid)).toEqual(["two"]);
    expect(first.input_tokens).toBe(10);
    db.retryResearchRun(run.id);
    mock.mockResolvedValueOnce(output);
    const resumed = await advanceResearchRun(run.id);
    expect(mock).toHaveBeenCalledTimes(3);
    expect(resumed.current_stage).toBe("thesis_building");
    expect(resumed.segment_processed).toBe(2);
    expect(resumed.input_tokens).toBe(20);
  } finally {
    mock.mockRestore(); db.closeDbForTest(); delete process.env.X_EQUITY_DB_PATH;
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
