import { createFileRoute } from "@tanstack/react-router";
import { ReportBuilder } from "@/components/report/ReportBuilder";

export const Route = createFileRoute("/report/$inspectionId")({
  head: ({ params }) => {
    const title = `Report — ${params.inspectionId.slice(0, 8)}…`;
    return {
      meta: [
        { title },
        {
          name: "description",
          content: "Build the residential valuation report for this inspection.",
        },
        { property: "og:title", content: title },
      ],
    };
  },
  component: ReportRoute,
});

function ReportRoute() {
  const { inspectionId } = Route.useParams();
  return <ReportBuilder inspectionId={inspectionId} />;
}
