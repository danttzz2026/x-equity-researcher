"use client";

import { useState, type ReactNode } from "react";

export function ReportReader({ chapters }: { chapters: Array<{ id: number; title: string; summary: string; minutes: number; content: ReactNode }> }) {
  const [selected, setSelected] = useState(0);
  const chapter = chapters[selected];
  if (!chapter) return null;
  return <div className="chapter-reader">
    <nav className="chapter-picker" aria-label="Research chapters">{chapters.map((item, index) => <button key={item.id} title={item.title} type="button" aria-current={selected === index ? "true" : undefined} onClick={() => setSelected(index)}><span>{String(index + 1).padStart(2, "0")}</span><span>{item.title}</span></button>)}</nav>
    <article className="chapter-preview" key={chapter.id}><span className="eyebrow">Chapter {selected + 1} of {chapters.length}</span><h2>{chapter.title}</h2>{chapter.summary && <p className="chapter-takeaway">{chapter.summary}</p>}
      <details className="chapter-full"><summary>Read full chapter <span>{chapter.minutes} min</span></summary><div>{chapter.content}</div></details>
      <div className="chapter-pagination"><button className="btn btn-secondary" disabled={selected === 0} onClick={() => setSelected(selected - 1)}>← Previous</button><button className="btn btn-secondary" disabled={selected === chapters.length - 1} onClick={() => setSelected(selected + 1)}>Next chapter →</button></div>
    </article>
  </div>;
}
