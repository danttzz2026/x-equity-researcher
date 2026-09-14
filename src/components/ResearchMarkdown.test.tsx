import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { ResearchMarkdown } from "./ResearchMarkdown";

it("renders tables and resolves each transcript reference without enabling model HTML", () => {
  const markdown = "**Claim** [Transcript: first, Transcript: second, missing]\n\n| Layer | Exposure |\n| --- | --- |\n| Power | Direct |\n\n<script>alert(1)</script>\n\n[unsafe](javascript:alert(1))\n\n![tracking](https://example.com/pixel)";
  const html = renderToStaticMarkup(<ResearchMarkdown sourceId={7} claims={[{ id: 10, claim_uid: "first" }, { id: 11, claim_uid: "second" }]}>{markdown}</ResearchMarkdown>);
  expect(html).toContain("<strong>Claim</strong>");
  expect(html).toContain('<table>');
  expect(html).toContain('/sources/7/claims?claim=10#claim-10');
  expect(html).toContain('/sources/7/claims?claim=11#claim-11');
  expect(html).toContain('Unresolved transcript citation: missing');
  expect(html).not.toContain('<script');
  expect(html).not.toContain('href="javascript:');
  expect(html).not.toContain('<img');
});
