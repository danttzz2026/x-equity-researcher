"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { ResearchRunStatusDetail, ResearchStage } from "@/lib/types";

const steps: Array<{ stage: ResearchStage; label: string }> = [
  { stage: "segment_extraction", label: "Extract evidence" },
  { stage: "thesis_building", label: "Build theses" },
  { stage: "web_verification", label: "Check web sources" },
  { stage: "equity_mapping", label: "Map equities" },
  { stage: "report_writing", label: "Write report" },
  { stage: "audit", label: "Review coverage" },
];

async function post(url: string) {
  const response = await fetch(url, { method: "POST" });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Research request failed. Try resuming the run.");
  return data;
}

export function ResearchButton({ sourceId, hasResearch, activeRun, configured = true }: {
  sourceId: number; hasResearch?: boolean; activeRun?: ResearchRunStatusDetail | null; configured?: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [pausing, setPausing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [run, setRun] = useState<ResearchRunStatusDetail | null>(activeRun ?? null);
  const stop = useRef(false);
  const busy = useRef(false);
  useEffect(() => () => { stop.current = true; }, []);

  async function runResearch() {
    if (busy.current) return;
    busy.current = true; stop.current = false;
    setLoading(true); setPausing(false); setError(null);
    try {
      const started = await post(`/api/sources/${sourceId}/research`);
      while (!stop.current) {
        const next = await post(`/api/research-runs/${started.run_id}/advance`) as ResearchRunStatusDetail;
        setRun(next);
        if (next.status === "completed") break;
        if (next.status === "error") throw new Error(next.error_message || "Research paused. Resume to retry this step.");
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Research failed.");
    } finally {
      busy.current = false; setLoading(false); setPausing(false); router.refresh();
    }
  }
  const completed = run?.status === "completed";
  const step = run ? steps.findIndex((item) => item.stage === run.current_stage) : -1;
  const fraction = run?.progress_total ? Math.min(1, run.progress_current / run.progress_total) : 0;
  const percent = completed ? 100 : Math.max(0, Math.round(((Math.max(step, 0) + fraction) / steps.length) * 100));
  return <div className="research-control">
    <div className="research-control-heading"><div><span className="eyebrow">Research engine</span><h2>{loading ? pausing ? "Pausing after this step…" : "Research in progress" : completed ? "Your research is ready" : run ? "Continue your research" : hasResearch ? "Explore this source again" : "Turn this source into research"}</h2></div>
      <div className="hero-actions"><button type="button" className="btn btn-primary" onClick={runResearch} disabled={loading || !configured}>{loading ? "Working…" : run && !completed ? "Resume research" : hasResearch || completed ? "Run new version" : "Start research"}</button>{loading && <button className="btn btn-secondary" disabled={pausing} onClick={() => { stop.current = true; setPausing(true); }}>Pause</button>}</div>
    </div>
    {!configured ? <p className="notice">Connect your Gemini API key to start. <Link href="/settings">Open setup instructions ↗</Link></p> : <p className="helper-text">{loading ? "Keep this page open. Each completed step is saved; pausing waits for the current request to finish." : run && !completed ? "Completed steps are saved. Resume continues from the last unfinished step." : "Extract evidence, investigate the thesis, and map potential equities. Uses your Gemini API key."}</p>}
    {run && <div className="research-progress" role="status" aria-live="polite"><div className="research-progress-copy"><strong>{completed ? "Complete" : steps[step]?.label || "Preparing research"}</strong><span>{percent}%{!completed && run.progress_total > 0 ? ` · ${run.progress_current}/${run.progress_total} in this step` : ""}</span></div><div className="research-progress-track"><span style={{ width: `${percent}%` }} /></div><ol className="research-steps">{steps.map((item, index) => <li key={item.stage} className={completed || index < step ? "done" : index === step ? "current" : ""}>{completed || index < step ? "✓ " : `${index + 1}. `}{item.label}</li>)}</ol><div className="meta"><span>{run.claim_count} claims</span><span>{run.thesis_count} theses</span><span>{run.ticker_count} equities</span></div></div>}
    {(error || run?.error_message) && <p className="form-error" role="alert">{error || run?.error_message}</p>}
  </div>;
}
