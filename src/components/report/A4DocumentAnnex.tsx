import type { ReportPhoto } from "@/lib/report/types";

/**
 * One printed A4 sheet per source PDF page. Heading repeats on each sheet
 * (same rule as subject / comparable photo annexes).
 */
export function A4DocumentAnnex({
  heading,
  pages,
  id,
  pageHeading,
}: {
  heading: string;
  pages: ReportPhoto[];
  id?: string;
  /** Per-page caption. The section id stays on the document, so the TOC has one entry. */
  pageHeading?: (page: ReportPhoto, index: number) => string;
}) {
  if (pages.length === 0) return null;
  return (
    <section id={id} className="report-annexure report-a4-annex">
      {pages.map((photo, index) => (
        <figure key={photo.id} className="report-a4-page">
          <h2 className="photo-annex-heading">{pageHeading ? pageHeading(photo, index) : heading}</h2>
          <img src={photo.url} alt={pageHeading ? pageHeading(photo, index) : photo.caption || heading} />
        </figure>
      ))}
    </section>
  );
}
