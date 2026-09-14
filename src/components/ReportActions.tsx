"use client";

import { useState } from "react";

export function ReportActions({ title, markdown }: { title: string; markdown: string }) {
  const [status, setStatus] = useState("");
  async function copy() {
    try { await navigator.clipboard.writeText(markdown); setStatus("Report copied."); }
    catch { setStatus("Clipboard unavailable. Use Download instead."); }
  }
  function download() {
    const url = URL.createObjectURL(new Blob([markdown], { type: "text/markdown;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url; link.download = `${title.replace(/[^a-z0-9]+/gi, "-").slice(0, 80) || "research-report"}.md`;
    link.click(); URL.revokeObjectURL(url);
  }
  return <div className="report-actions"><button className="btn btn-secondary" onClick={copy}>Copy report</button><button className="btn btn-secondary" onClick={download}>Download .md</button><span role="status">{status}</span></div>;
}
