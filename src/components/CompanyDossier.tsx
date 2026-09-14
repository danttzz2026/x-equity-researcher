import type { CompanyDossier as CompanyDossierType } from "@/lib/types";
import { ResearchMarkdown } from "./ResearchMarkdown";

export function CompanyDossier({ dossier }: { dossier: CompanyDossierType }) {
  return <article className="company-dossier"><ResearchMarkdown>{dossier.body_markdown}</ResearchMarkdown></article>;
}
