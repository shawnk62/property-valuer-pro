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

/**
 * Schema field names only (inspection-schema.json).
 * Do not invent keys — form will not display unknown names.
 */
const TARGET_FIELDS = [
  "prop_address",
  "prop_suburb",
  "prop_state",
  "prop_postcode",
  "prop_lotplan",
  "prop_title",
  "prop_legal",
  "prop_lga",
  "prop_sitearea",
  "prop_areaunit",
  "prop_dimensions",
  "prop_zoning",
  "prop_zoning_desc",
  "prop_flood",
  "prop_flood_map",
  "prop_adverse_site",
  "imp_beds",
  "imp_baths",
] as const;

/** Map common AI / legacy aliases → schema keys. */
const FIELD_ALIASES: Record<string, (typeof TARGET_FIELDS)[number]> = {
  prop_lot_plan: "prop_lotplan",
  prop_lot_plan_number: "prop_lotplan",
  lot_plan: "prop_lotplan",
  lotplan: "prop_lotplan",
  prop_title_ref: "prop_title",
  prop_title_reference: "prop_title",
  title_reference: "prop_title",
  prop_legal_desc: "prop_legal",
  prop_legal_description: "prop_legal",
  legal_description: "prop_legal",
  prop_land_area: "prop_sitearea",
  prop_land_size: "prop_sitearea",
  land_area: "prop_sitearea",
  land_size: "prop_sitearea",
  prop_use: "prop_zoning_desc",
  prop_town_planning: "prop_zoning_desc",
  zoning: "prop_zoning",
  zones: "prop_zoning",
  zone: "prop_zoning",
  zone_code: "prop_zoning",
  prop_zones: "prop_zoning",
  zoning_classification: "prop_zoning",
  zoning_description: "prop_zoning_desc",
  zone_description: "prop_zoning_desc",
  zone_name: "prop_zoning_desc",
  lga: "prop_lga",
  council: "prop_lga",
  overlays: "prop_adverse_site",
  prop_overlays: "prop_adverse_site",
  flood: "prop_flood",
  prop_flood_hazard: "prop_flood",
  beds: "imp_beds",
  bedrooms: "imp_beds",
  baths: "imp_baths",
  bathrooms: "imp_baths",
};

function normalizeCandidates(
  raw: Record<string, string | null> | null | undefined,
): Record<string, string> {
  const out: Record<string, string> = {};
  if (!raw || typeof raw !== "object") return out;

  for (const [key, value] of Object.entries(raw)) {
    if (value == null) continue;
    const text = String(value).trim();
    if (!text || text.toLowerCase() === "null" || text.toLowerCase() === "unavailable") {
      continue;
    }
    const mapped =
      (TARGET_FIELDS as readonly string[]).includes(key)
        ? key
        : FIELD_ALIASES[key] ?? FIELD_ALIASES[key.toLowerCase()];
    if (!mapped) continue;
    // Prefer first non-empty; do not overwrite with weaker alias later if already set
    if (!out[mapped]) out[mapped] = text;
  }

  // Normalise state
  if (out.prop_state) {
    const s = out.prop_state.toUpperCase();
    if (s.includes("QUEENSLAND") || s === "QLD") out.prop_state = "QLD";
  }
  // Land area unit hint + strip unit text from site area
  if (out.prop_sitearea) {
    const raw = out.prop_sitearea.replace(/,/g, "");
    const num = raw.match(/(\d+(?:\.\d+)?)/);
    if (num) out.prop_sitearea = num[1]!;
    if (/m\s*²|m2|sqm/i.test(raw) && !out.prop_areaunit) out.prop_areaunit = "m2";
    if (/\bha\b|hectare/i.test(raw) && !out.prop_areaunit) out.prop_areaunit = "ha";
  }
  // Flood select: Yes | No | Unknown
  if (out.prop_flood) {
    const f = out.prop_flood.toLowerCase();
    if (/\byes\b|affected|within|prone|hazard/.test(f) && !/unaffected|not\s+affected|not\s+within/.test(f)) {
      out.prop_flood = "Yes";
    } else if (/\bno\b|unaffected|not\s+affected|not\s+within|not\s+specified\s+as/.test(f)) {
      out.prop_flood = "No";
    } else if (/unknown/.test(f)) {
      out.prop_flood = "Unknown";
    }
  }

  // Split Landchecker-style "LDR - Low Density Residential" into classification + description
  splitZoningFields(out);

  return out;
}

/**
 * Landchecker often prints ZONES as "LDR - Low Density Residential".
 * Classification ← code (LDR); Description ← name (Low Density Residential).
 * If only a long purpose paragraph is present, keep it on prop_zoning_desc.
 */
function splitZoningFields(out: Record<string, string>) {
  const rawZoning = out.prop_zoning?.trim();
  const rawDesc = out.prop_zoning_desc?.trim();

  const trySplit = (text: string): { code: string; name: string } | null => {
    // "LDR - Low Density Residential" or "LDR – Low Density Residential"
    const m = text.match(
      /^([A-Z]{1,6}(?:\s*\/[A-Z]{1,6})?)\s*[-–—:]\s+(.+)$/i,
    );
    if (m) {
      return { code: m[1]!.trim().toUpperCase(), name: m[2]!.trim() };
    }
    // Code only
    if (/^[A-Z]{1,6}$/i.test(text)) {
      return { code: text.toUpperCase(), name: "" };
    }
    return null;
  };

  if (rawZoning) {
    const split = trySplit(rawZoning);
    if (split) {
      out.prop_zoning = split.code;
      if (split.name && !rawDesc) {
        out.prop_zoning_desc = split.name;
      } else if (split.name && rawDesc && rawDesc === rawZoning) {
        out.prop_zoning_desc = split.name;
      }
    }
  }

  // Description accidentally holds the combined "LDR - …" string
  if (rawDesc && !out.prop_zoning) {
    const split = trySplit(rawDesc);
    if (split?.code) {
      out.prop_zoning = split.code;
      if (split.name) out.prop_zoning_desc = split.name;
    }
  }

  // If zoning still empty but description starts with a code
  if (!out.prop_zoning && out.prop_zoning_desc) {
    const split = trySplit(out.prop_zoning_desc);
    if (split?.code) {
      out.prop_zoning = split.code;
      if (split.name) out.prop_zoning_desc = split.name;
    }
  }
}

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
  const [candidates, setCandidates] = useState<Record<string, string> | null>(null);

  const applyPatch = useCallback(
    (patch: Record<string, string>) => {
      if (Object.keys(patch).length === 0) return;
      onApply(patch as Partial<InspectionValues>);
    },
    [onApply],
  );

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
              file: { mimeType: file.type || "application/pdf", base64: await fileToBase64(file) },
            }
          : {
              settings,
              source: "text" as const,
              text,
            };

      const result = await extractPropertyData({ data: payload });
      const raw =
        result && typeof result === "object" && "candidates" in result
          ? (result as { candidates: Record<string, string | null> }).candidates
          : {};
      const patch = normalizeCandidates(raw);
      setCandidates(patch);

      if (Object.keys(patch).length === 0) {
        toast.message("No fields could be extracted", {
          description: "Try pasting the full property summary text, or a clearer extract.",
        });
        return;
      }

      // Apply immediately — user expectation is that Extract fills the form
      applyPatch(patch);
      toast.success(`Applied ${Object.keys(patch).length} field(s) to the form`, {
        description: Object.keys(patch)
          .map((k) => labelForField(k))
          .slice(0, 6)
          .join(", "),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Extraction failed";
      toast.error(message);
    } finally {
      setExtracting(false);
    }
  }, [text, file, applyPatch]);


    const hasResults = candidates && Object.keys(candidates).length > 0;

  return (
    <Card className="border-dashed">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 font-serif text-base">
          <MapPin className="size-4 text-primary" />
          Import property data
        </CardTitle>
        <CardDescription>
          Upload a Landchecker Property Report PDF (preferred) or paste a property summary. AI fills
          Section 1 identity fields (address, lot/plan, LGA, land size, zoning, overlays, flood).
          Maps are attached manually on the report Photos tab.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="landchecker-text">Property summary text (optional if uploading a PDF)</Label>
          <Textarea
            id="landchecker-text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Paste the property summary here..."
            rows={4}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="landchecker-file">Landchecker Property Report PDF (or image)</Label>
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
          {extracting ? "Extracting..." : "Extract from Landchecker / summary"}
        </Button>

        {hasResults ? (
          <div className="rounded-md border border-border bg-muted/50 p-3">
            <p className="text-sm font-medium text-foreground">Applied to form</p>
            <dl className="mt-2 space-y-1 text-sm">
              {Object.entries(candidates!).map(([field, value]) => (
                <div key={field} className="flex justify-between gap-2">
                  <dt className="text-muted-foreground">{labelForField(field)}</dt>
                  <dd className="max-w-[60%] truncate font-medium text-foreground">{value}</dd>
                </div>
              ))}
            </dl>
            <Button
              onClick={() => applyPatch(candidates!)}
              className="mt-3 w-full"
              size="sm"
              variant="outline"
            >
              <FileUp className="mr-2 size-4" />
              Re-apply to form
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
