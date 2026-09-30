import { useState } from "react";
import { FileUp, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { inspectionStore } from "@/lib/inspection/storage";
import { extractTextFromPdf } from "@/lib/report/extractPdfText";
import { fileToDataUrl, preparePhotoForReport } from "@/lib/report/photo-data";
import { photoBlobKey, putPhotoBlob } from "@/lib/report/photo-idb";
import { uploadReportPhoto } from "@/lib/report/photo-storage";
import { rasterizePdfPages } from "@/lib/report/rasterizePdfPages";
import { nowPhotoTimestamp } from "@/lib/inspection/photoRequirements";
import {
  mergeTitleSearchExtract,
  parseTitleSearchText,
} from "@/lib/report/parseTitleSearch";
import type { InspectionValues } from "@/lib/inspection/types";
import type { ReportPhoto } from "@/lib/report/types";

interface Props {
  inspectionId: string;
  values: InspectionValues;
  onApply: (patch: Partial<InspectionValues>) => void;
}

function newPhotoId(): string {
  return `photo-${Math.random().toString(36).slice(2, 10)}`;
}

export function TitleSearchImport({ inspectionId, values, onApply }: Props) {
  const [busy, setBusy] = useState(false);
  const [includeAnnex, setIncludeAnnex] = useState(true);

  async function onFile(file: File | null) {
    if (!file) return;
    const isPdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name);
    if (!isPdf && !file.type.startsWith("image/")) {
      toast.error("Choose a Titles Queensland PDF or an image of the search");
      return;
    }
    setBusy(true);
    try {
      let text = "";
      if (isPdf) {
        try {
          text = await extractTextFromPdf(file);
        } catch (err) {
          console.warn("[title search] text extract failed", err);
        }
      }
      const extracted = parseTitleSearchText(text);
      const patch = mergeTitleSearchExtract(values, extracted);
      if (Object.keys(patch).length) onApply(patch);

      const pages = isPdf ? await rasterizePdfPages(file) : [file];
      const extras = (await inspectionStore.getReportExtras(inspectionId)) ?? {};
      const existing = Array.isArray(extras.photos) ? extras.photos : [];
      const kept = existing.filter(
        (p) =>
          !(
            p &&
            typeof p === "object" &&
            ((p as ReportPhoto).kind === "title" ||
              /title search|certificate of title/i.test(String((p as ReportPhoto).caption ?? "")))
          ),
      );
      const next: ReportPhoto[] = [...(kept as ReportPhoto[])];
      for (let i = 0; i < pages.length; i++) {
        const id = newPhotoId();
        const prepared = await preparePhotoForReport(pages[i]);
        const localKey = photoBlobKey(inspectionId, id);
        await putPhotoBlob(localKey, prepared);
        let url = "";
        let storagePath: string | undefined;
        try {
          const uploaded = await uploadReportPhoto({
            inspectionId,
            photoId: id,
            file: prepared,
          });
          url = uploaded.url;
          storagePath = uploaded.storagePath;
        } catch {
          url = await fileToDataUrl(prepared);
        }
        next.push({
          id,
          slot: null,
          caption: `Current Title Search — page ${i + 1}`,
          url,
          localBlobKey: localKey,
          ...(storagePath ? { storagePath } : {}),
          capturedAt: nowPhotoTimestamp(),
          kind: "title",
          omitFromReport: !includeAnnex,
        });
      }
      await inspectionStore.saveReportExtras(inspectionId, {
        ...extras,
        photos: next.map((p) => ({
          id: p.id,
          slot: p.slot,
          caption: p.caption,
          url: /^https?:\/\//i.test(p.url) ? p.url : "",
          ...(p.storagePath ? { storagePath: p.storagePath } : {}),
          ...(p.capturedAt ? { capturedAt: p.capturedAt } : {}),
          ...(p.localBlobKey ? { localBlobKey: p.localBlobKey } : {}),
          ...(p.kind ? { kind: p.kind } : {}),
          ...(p.omitFromReport ? { omitFromReport: true } : {}),
        })),
      });

      const filled = Object.keys(patch);
      toast.success(
        filled.length
          ? `Title search imported (${filled.length} field${filled.length === 1 ? "" : "s"})`
          : "Title search attached",
        {
          description: includeAnnex
            ? "Pages added to the Certificate of Title annexure."
            : "Pages saved in the working file and omitted from print.",
        },
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not import the title search");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="mt-4">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Current Title Search</CardTitle>
        <CardDescription>
          Upload a Titles Queensland Current Title Search. Fields are filled on this form. Tick
          to print the pages in the annexure.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="size-3.5 rounded border-input"
            checked={includeAnnex}
            onChange={(e) => setIncludeAnnex(e.target.checked)}
          />
          Include title search in printed annexure
        </label>
        <div>
          <Label htmlFor="title-search-file">Titles Queensland PDF</Label>
          <input
            id="title-search-file"
            type="file"
            accept="application/pdf,image/*"
            className="mt-1 block w-full text-sm"
            disabled={busy}
            onChange={(e) => void onFile(e.target.files?.[0] ?? null)}
          />
        </div>
        <Button
          type="button"
          variant="outline"
          disabled={busy}
          onClick={() => document.getElementById("title-search-file")?.click()}
        >
          {busy ? <Loader2 className="mr-2 size-4 animate-spin" /> : <FileUp className="mr-2 size-4" />}
          {busy ? "Importing…" : "Import title search"}
        </Button>
      </CardContent>
    </Card>
  );
}
