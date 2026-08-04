import { useCallback, useState } from "react";
import { FileUp, Loader2, MapPin, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { extractPropertyData } from "@/lib/ai/ai.functions";
import { isAiConfigured, loadAiSettings } from "@/lib/ai/settings";
import { labelForField } from "@/lib/inspection/schema";
import type { InspectionValues } from "@/lib/inspection/types";

interface ImportPanelProps {
  values: InspectionValues;
  onApply: (patch: Partial<InspectionValues>) => void;
}

const TARGET_FIELDS = [
  "prop_address",
  "prop_suburb",
  "prop_state",
  "prop_postcode",
  "prop_lot_plan",
  "prop_title_ref",
  "prop_legal_desc",
  "prop_lga",
  "prop_land_area",
  "prop_zoning",
  "prop_use",
  "prop_town_planning",
];

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(",")[1] ?? "");
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function ImportPanel({ values, onApply }: ImportPanelProps) {
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [candidates, setCandidates] = useState<Record<string, string | null> | null>(null);

  const extract = useCallback(async () => {
    const settings = loadAiSettings();
    if (!isAiConfigured(settings)) {
      toast.error("Configure an AI provider in Settings first");
      return;
    }

    setExtracting(true);
    try {
      const payload =
        file && !text.trim()
          ? {
              settings,
              source: "file" as const,
              file: { mimeType: file.type, base64: await fileToBase64(file) },
            }
          : {
              settings,
              source: "text" as const,
              text,
            };

      const result = await extractPropertyData({ data: payload });
      setCandidates(result.candidates);
      if (Object.keys(result.candidates).length === 0) {
        toast("No fields could be extracted. Try pasting more detail.");
      } else {
        toast.success("Extraction complete");
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Extraction failed";
      toast.error(message);
    } finally {
      setExtracting(false);
    }
  }, [text, file]);

  const apply = () => {
    if (!candidates) return;
    const patch: Partial<InspectionValues> = {};
    for (const field of TARGET_FIELDS) {
      const value = candidates[field];
      if (value && value.trim()) {
        patch[field] = value.trim();
      }
    }
    onApply(patch);
    toast.success("Fields applied");
  };

  const hasResults = candidates && Object.values(candidates).some((v) => v && v.trim());

  return (
    <Card className="border-dashed">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 font-serif text-base">
          <MapPin className="size-4 text-primary" />
          Import property data
        </CardTitle>
        <CardDescription>
          Paste a Landchecker export, property summary, or upload a PDF/image. The configured AI extracts Section 1
          fields automatically.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="landchecker-text">Property summary text</Label>
          <Textarea
            id="landchecker-text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Paste the property summary here..."
            rows={4}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="landchecker-file">Or upload a file</Label>
          <input
            id="landchecker-file"
            type="file"
            accept=".pdf,.png,.jpg,.jpeg,.webp"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="block w-full text-sm text-muted-foreground file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-2 file:text-xs file:font-medium file:text-primary-foreground"
          />
          {file ? <p className="text-xs text-muted-foreground">Selected: {file.name}</p> : null}
        </div>

        <Button
          onClick={() => void extract()}
          disabled={extracting || (!text.trim() && !file)}
          variant="secondary"
          className="w-full"
        >
          {extracting ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Wand2 className="mr-2 size-4" />}
          {extracting ? "Extracting..." : "Extract fields"}
        </Button>

        {hasResults ? (
          <div className="rounded-md border border-border bg-muted/50 p-3">
            <p className="text-sm font-medium text-foreground">Extracted fields</p>
            <dl className="mt-2 space-y-1 text-sm">
              {TARGET_FIELDS.filter((f) => candidates[f]).map((field) => (
                <div key={field} className="flex justify-between gap-2">
                  <dt className="text-muted-foreground">{labelForField(field)}</dt>
                  <dd className="max-w-[60%] truncate font-medium text-foreground">{candidates[field]}</dd>
                </div>
              ))}
            </dl>
            <Button onClick={apply} className="mt-3 w-full" size="sm">
              <FileUp className="mr-2 size-4" />
              Apply to form
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
