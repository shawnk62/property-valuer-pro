import type { ReportPhoto } from "@/lib/report/types";

/**
 * One printed A4 sheet per source PDF page. Heading repeats on each sheet
 * (same rule as subject / comparable photo annexes).
 */
export function A4DocumentAnnex({
  heading,
  pages,
  id,
}: {
  heading: string;
  pages: ReportPhoto[];
  id?: string;
}) {
  if (pages.length === 0) return null;
  return (
    <section id={id} className="report-annexure report-a4-annex">
      {pages.map((photo) => (
        <figure key={photo.id} className="report-a4-page">
          <h2 className="photo-annex-heading">{heading}</h2>
          <img src={photo.url} alt={photo.caption || heading} />
        </figure>
      ))}
    </section>
  );
}
