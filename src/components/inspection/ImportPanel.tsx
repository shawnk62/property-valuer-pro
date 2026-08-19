import { useCallback, useState } from "react";
import { FileUp, Loader2, MapPin, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { extractPropertyData } from "@/lib/ai/ai.functions";
import { extractTextFromPdf } from "@/lib/report/extractPdfText";
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
  "prop_orientation",
  "prop_zoning",
  "prop_zoning_desc",
  "prop_flood",
  "prop_flood_map",
  "prop_adverse_site",
  "prop_place_based",
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
  orientation: "prop_orientation",
  frontage: "prop_dimensions",
  prop_frontage: "prop_dimensions",
  place_based: "prop_place_based",
  place_based_plans: "prop_place_based",
  prop_place_based_plans: "prop_place_based",
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


/**
 * Deterministic parse of Landchecker "Details" style text.
 * Used when AI returns nothing so Section 1 still fills from PDF text.
 */
function parseLandcheckerText(raw: string): Record<string, string> {
  const text = raw.replace(/\r/g, "\n");
  const out: Record<string, string> = {};

  const afterLabel = (labels: string[]): string | null => {
    for (const label of labels) {
      const re = new RegExp(
        label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") +
          "\\s*[:\\n]?\\s*([^\\n]{1,200})",
        "i",
      );
      const m = text.match(re);
      if (m?.[1]) {
        const v = m[1].trim();
        if (v && !/^unavailable$/i.test(v)) return v;
      }
    }
    return null;
  };

  const lga = afterLabel([
    "LOCAL GOVERNMENT (COUNCIL)",
    "LOCAL GOVERNMENT",
    "COUNCIL",
  ]);
  if (lga) out.prop_lga = lga;

  const landSize = afterLabel(["LAND SIZE", "SITE AREA", "LAND AREA"]);
  if (landSize) {
    const num = landSize.replace(/,/g, "").match(/(\d+(?:\.\d+)?)/);
    if (num) out.prop_sitearea = num[1]!;
    if (/m\s*²|m2|sqm/i.test(landSize)) out.prop_areaunit = "m2";
    if (/\bha\b|hectare/i.test(landSize)) out.prop_areaunit = "ha";
  }

  const orientation = afterLabel(["ORIENTATION"]);
  if (orientation) out.prop_orientation = orientation;

  const frontage = afterLabel(["FRONTAGE"]);
  if (frontage) {
    const cleaned = frontage.replace(/\s*Approx\.?/i, "").trim();
    out.prop_dimensions = cleaned.toLowerCase().startsWith("frontage")
      ? cleaned
      : `Frontage ${cleaned}`;
  }

  const zones = afterLabel(["ZONES", "ZONE", "ZONING"]);
  if (zones) out.prop_zoning = zones;

  // OVERLAYS: capture multi-line list until next major heading
  {
    const m = text.match(
      /OVERLAYS?\s*\n([\s\S]{0,800}?)(?=\n\s*(?:Parcel Identifiers|LOT\/PLAN|PropTrack|FLOOD|Zones|ZONE PURPOSE|Place-based|Nearby|Terms|Disclaimer)\b|$)/i,
    );
    if (m?.[1]) {
      const lines = m[1]
        .split("\n")
        .map((l) => l.trim())
        .filter((l) => l && !/^unavailable$/i.test(l) && l.length > 2);
      if (lines.length) out.prop_adverse_site = lines.join("; ");
    }
  }

  const lotPlan = afterLabel(["LOT/PLAN", "LOT / PLAN", "LOT PLAN"]);
  if (lotPlan) {
    out.prop_lotplan = lotPlan;
    out.prop_legal = lotPlan;
  }

  // Address from "Property Report" header lines
  {
    const m = text.match(
      /(?:Property Report|PROPERTY REPORT)\s*\n\s*(\d+[^\n,]{3,60})\s*\n?\s*([A-Za-z][A-Za-z\s'-]+?)\s+(QLD|NSW|VIC|SA|WA|TAS|NT|ACT)\s+(\d{4})/i,
    );
    if (m) {
      out.prop_address = m[1]!.trim();
      out.prop_suburb = m[2]!.trim();
      out.prop_state = m[3]!.toUpperCase();
      out.prop_postcode = m[4]!;
    } else {
      // "13 Banksia Street, Shelly Beach Qld 4551"
      const m2 = text.match(
        /(\d+\s+[A-Za-z0-9][^\n,]{2,50}),\s*([A-Za-z][A-Za-z\s'-]+?)\s+(Qld|QLD|NSW|VIC|SA|WA|TAS|NT|ACT)\s+(\d{4})/i,
      );
      if (m2) {
        out.prop_address = m2[1]!.trim();
        out.prop_suburb = m2[2]!.trim();
        out.prop_state = m2[3]!.toUpperCase() === "QLD" || m2[3]!.toLowerCase() === "qld" ? "QLD" : m2[3]!.toUpperCase();
        out.prop_postcode = m2[4]!;
      }
    }
  }

  // PropTrack beds/baths: look for patterns near HOUSE
  {
    const bed = text.match(/\bHOUSE\b[\s\S]{0,120}?\b(\d+)\s*(?:bed|beds|bedroom)/i)
      || text.match(/\b(\d+)\s*(?:bed|beds|bedrooms)\b/i);
    if (bed) out.imp_beds = bed[1]!;
    const bath = text.match(/\bHOUSE\b[\s\S]{0,120}?\b(\d+)\s*(?:bath|baths|bathroom)/i)
      || text.match(/\b(\d+)\s*(?:bath|baths|bathrooms)\b/i);
    if (bath) out.imp_baths = bath[1]!;
  }

  // Flood
  {
    if (/FLOOD[\s\S]{0,400}?Unaffected|not subject to flood|not affected by flood/i.test(text)) {
      out.prop_flood = "No";
    } else if (/FLOOD[\s\S]{0,400}?(?:Affected|subject to flood|flood hazard)/i.test(text)) {
      out.prop_flood = "Yes";
    }
  }

  // Place-based plans block (purpose text)
  {
    const m = text.match(
      /Place-based plans?\s*\n([\s\S]{200,12000}?)(?=\n\s*(?:Nearby Planning|Planning Permits|Sales History|Terms and Conditions|Disclaimer)\b|$)/i,
    );
    if (m?.[1]) {
      const body = m[1].trim();
      if (body.length > 40 && !/^none\b/i.test(body)) {
        out.prop_place_based = body.slice(0, 12000);
      }
    }
  }

  // Zone purpose paragraph
  {
    const m = text.match(
      /(?:The purpose of the [^\n]{10,80} zone[^\n]*\n[\s\S]{50,3000}?)(?=\n\s*(?:OVERLAYS|Place-based|Flood|Parcel)\b|$)/i,
    );
    if (m?.[0]) out.prop_zoning_desc = m[0].trim().slice(0, 4000);
  }

  return out;
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
    setCandidates(null);
    try {
      let pdfText = text.trim();
      let base64: string | undefined;
      let mimeType: string | undefined;

      if (file) {
        const isPdf =
          file.type === "application/pdf" ||
          file.name.toLowerCase().endsWith(".pdf");
        // Always pull text from PDFs in the browser — more reliable than
        // sending a multi-page PDF as a file part alone.
        if (isPdf) {
          try {
            const extracted = await extractTextFromPdf(file);
            if (extracted.trim().length > 80) {
              pdfText = [pdfText, extracted.trim()].filter(Boolean).join("\n\n");
            }
          } catch (pdfErr) {
            console.warn("[ImportPanel] pdf.js text extract failed", pdfErr);
          }
        }
        // Still attach the file when text is thin (images / scanned pages)
        if (!isPdf || pdfText.length < 200) {
          base64 = await fileToBase64(file);
          mimeType = file.type || (isPdf ? "application/pdf" : "image/png");
        }
      }

      if (!pdfText && !base64) {
        toast.error("Paste summary text or choose a Landchecker PDF first");
        return;
      }

      // Prefer text source when we have substantial PDF text
      const useFile = Boolean(base64) && pdfText.length < 200;
      const result = await extractPropertyData({
        data: {
          settings,
          source: useFile ? "file" : "text",
          text: pdfText || undefined,
          file:
            useFile && base64
              ? { base64, mimeType: mimeType || "application/pdf" }
              : undefined,
        },
      });

      let patch = normalizeCandidates(result.candidates);

      // Fallback / fill gaps from deterministic Landchecker label parse
      if (pdfText.length > 80) {
        const heuristic = normalizeCandidates(parseLandcheckerText(pdfText));
        if (Object.keys(patch).length === 0) {
          patch = heuristic;
        } else {
          for (const [k, v] of Object.entries(heuristic)) {
            if (!patch[k] && v) patch[k] = v;
          }
        }
      }

      setCandidates(Object.keys(patch).length > 0 ? patch : null);

      if (Object.keys(patch).length === 0) {
        toast.error("No fields could be extracted", {
          description:
            pdfText.length > 80
              ? "PDF text was read but no mapped fields were found. Check AI settings, then try again."
              : "Try pasting the full property summary text, or a clearer extract.",
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
