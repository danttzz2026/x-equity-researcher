import { notFound } from "next/navigation";
import Link from "next/link";
import { CompanyDossier } from "@/components/CompanyDossier";
import { getCompanyDossier } from "@/lib/db";

export const dynamic = "force-dynamic";
export default async function CompanyPage({ params }: { params: Promise<{ id: string; symbol: string }> }) {
  const { id, symbol } = await params; const sourceId = Number(id); const dossier = getCompanyDossier(sourceId, symbol); if (!dossier) notFound();
  return <><header className="page-head"><div className="meta"><Link href={`/sources/${sourceId}`}>Back to source</Link><Link href={`/tickers/${dossier.symbol}`}>Cross-source ticker view</Link></div><h1>{dossier.symbol} <span className="muted-title">{dossier.company_name}</span></h1><p>Source-specific company dossier</p></header><section className="section"><div className="panel"><CompanyDossier dossier={dossier} /></div></section></>;
}
