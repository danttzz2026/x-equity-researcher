"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { SourceNav } from "./SourceNav";

export function SourceWorkspace({ sourceId, header, children }: { sourceId: number; header: ReactNode; children: ReactNode }) {
  const pathname = usePathname();
  return <div className="source-workspace">{header}<SourceNav sourceId={sourceId} /><div key={pathname} className="source-content" id="source-content" role="region" aria-label="Research view" tabIndex={0}>{children}</div></div>;
}
