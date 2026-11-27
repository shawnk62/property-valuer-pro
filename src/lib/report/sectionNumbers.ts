import { narrativePrints } from "@/lib/narrative/neighbourhoodAssist";
import { isVacantLand } from "@/lib/inspection/visibility";
import type { ReportDraft } from "@/lib/report/types";

/** Numbers only the sections that are included. Excluded slots stay 0. */
export function includedNumbers(flags: boolean[]): number[] {
  let n = 0;
  return flags.map((on) => (on ? ++n : 0));
}

export function majorTitle(n: number, title: string): string {
  return n > 0 ? `${n}.0 ${title}` : title;
}

export function subTitle(parent: number, child: number, title: string): string {
  if (parent < 1 || child < 1) return title;
  return `${parent}.${child} ${title}`;
}

/** The number a working-report block prints under, using the printed report's numbering. */
export function printedBlockNumber(draft: ReportDraft, key: string): string {
  const v = draft.values;
  const m = draft.reportMeta;
  const n = draft.narrative;
  const prints = (k: keyof typeof n) => narrativePrints(m, k, v);
  const has = (k: keyof typeof n) => Boolean(String(n[k] ?? "").trim());
  const show4 = prints("envIntro") || prints("acidSulphate") || prints("floodAssessment") || prints("noiseNuisances") || (prints("titleNotices") && has("titleNotices"));
  const show32 = prints("highestBestUse");
  const show5 = (prints("location") && (has("location") || Boolean(v["prop_address"]))) || (prints("neighbourhood") && has("neighbourhood")) || (prints("amenities") && has("amenities")) || (prints("popularDestinations") && has("popularDestinations"));
  const show6 = ["marketAustralia", "marketState", "marketRegion", "marketLocality"].some((k) => prints(k as keyof typeof n) && has(k as keyof typeof n));
  const show9 = prints("references");
  const major = includedNumbers([true, true, true, show4, show32, show5, show6, true, true, show9, false]);
  const n1 = includedNumbers([prints("instructions"), true, true, true]);
  const n2 = includedNumbers([prints("sitePhysical"), true, true]);
  const n4 = includedNumbers([prints("acidSulphate"), prints("floodAssessment"), prints("noiseNuisances"), prints("titleNotices") && has("titleNotices")]);
  const n5 = includedNumbers([prints("location"), prints("neighbourhood"), prints("amenities"), prints("popularDestinations")]);
  const n6 = includedNumbers([prints("marketAustralia"), prints("marketState"), prints("marketRegion"), prints("marketLocality")]);
  const showIncome = prints("leaseEvidence") || prints("capitalisationApproach") || prints("dcfApproach");
  const showCost = prints("costApproach") && !isVacantLand(v);
  const n8 = includedNumbers([true, showIncome, showCost, true, false, prints("salesAnalysis"), true, prints("disclaimer")]);
  const num = (parent: number, child: number) => (parent > 0 && child > 0 ? `${parent}.${child}` : "");
  const map: Record<string, string> = {
    instructions: num(major[0], n1[0]),
    sitePhysical: num(major[1], n2[0]),
    siteIdentification: num(major[1], n2[1]),
    legalAccess: num(major[1], n2[1]),
    titleSearchNarrative: num(major[1], n2[1]),
    encumbrancesSummary: num(major[1], n2[2]),
    physicalAccess: num(major[1], n2[2]),
    servicesAmenities: num(major[1], n2[2]),
    zoningPurpose: num(major[2], 1),
    envIntro: major[3] > 0 ? `${major[3]}.0` : "",
    acidSulphate: num(major[3], n4[0]),
    floodAssessment: num(major[3], n4[1]),
    noiseNuisances: num(major[3], n4[2]),
    titleNotices: num(major[3], n4[3]),
    highestBestUse: major[4] > 0 ? `${major[4]}.0` : "",
    location: num(major[5], n5[0]),
    neighbourhood: num(major[5], n5[1]),
    amenities: num(major[5], n5[2]),
    popularDestinations: num(major[5], n5[3]),
    marketAustralia: num(major[6], n6[0]),
    marketState: num(major[6], n6[1]),
    marketRegion: num(major[6], n6[2]),
    marketLocality: num(major[6], n6[3]),
    valuationApproach: major[8] > 0 ? `${major[8]}.0` : "",
    salesComments: num(major[8], n8[0]),
    marketReconciliation: num(major[8], n8[0]),
    leaseEvidence: num(major[8], n8[1]),
    capitalisationApproach: num(major[8], n8[1]),
    dcfApproach: num(major[8], n8[1]),
    incomeReconciliation: num(major[8], n8[1]),
    costApproach: num(major[8], n8[2]),
    costReconciliation: num(major[8], n8[2]),
    valueReconciliation: num(major[8], n8[3]),
    salesAnalysis: num(major[8], n8[5]),
    valuationResult: num(major[8], n8[6]),
    valuationReliance: num(major[8], n8[6]),
    disclaimer: num(major[8], n8[7]),
    assumptions: num(major[8], n8[7]),
    references: major[9] > 0 ? `${major[9]}.0` : "",
  };
  return map[key] ?? "";
}
