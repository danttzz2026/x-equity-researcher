"use client";

import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";

function TabLabel({ label }: { label: string }) {
  const { pending } = useLinkStatus();
  return <><span>{label}</span><span className={`tab-pending ${pending ? "is-pending" : ""}`} aria-hidden /></>;
}
export function SourceNav({ sourceId }: { sourceId: number }) {
  const pathname = usePathname();
  const base = `/sources/${sourceId}`;
  const links = [{ href: base, label: "Overview" }, { href: `${base}/report`, label: "Report" }, { href: `${base}/claims`, label: "Evidence" }];
  return <nav className="source-tabs" aria-label="Source research">{links.map(({ href, label }) => <Link key={href} href={href} prefetch scroll={false} aria-current={pathname === href ? "page" : undefined}><TabLabel label={label} /></Link>)}</nav>;
}
