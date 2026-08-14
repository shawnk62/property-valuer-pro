/**
 * Parse an RP Data (or similar) property-export CSV into ComparableSale rows.
 * Shared across all report types — the sales list/grid is report-type agnostic;
 * only report output formatting differs by type.
 */
import type { ComparableSale } from "./types";

export type SalesCsvField = keyof Omit<ComparableSale, "id">;

/** Normalise header text for matching. */
function normHeader(h: string): string {
  return h
    .replace(/^\uFEFF/, "")
    .trim()
    .toLowerCase()
    .replace(/[_/]+/g, " ")
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Map common RP Data / CoreLogic / generic export headers → our fields.
 * First matching header wins per field.
 */
const HEADER_ALIASES: Record<SalesCsvField, string[]> = {
  address: [
    "address",
    "property address",
    "full address",
    "street address",
    "property",
    "site address",
  ],
  saleDate: [
    "sale date",
    "sold date",
    "contract date",
    "settlement date",
    "date of sale",
    "sale settled",
    "sold",
  ],
  salePrice: [
    "sale price",
    "sold price",
    "price",
    "sale amount",
    "consideration",
    "sold amount",
  ],
  landArea: [
    "land area",
    "land size",
    "site area",
    "land",
    "area",
    "lot size",
    "land area m2",
    "land m2",
  ],
  comments: [
    "comments",
    "comment",
    "notes",
    "description",
    "remarks",
    "property description",
    "summary",
  ],
};

function matchField(header: string): SalesCsvField | null {
  const n = normHeader(header);
  if (!n) return null;
  for (const [field, aliases] of Object.entries(HEADER_ALIASES) as [
    SalesCsvField,
    string[],
  ][]) {
    for (const a of aliases) {
      if (n === a || n.includes(a) || a.includes(n)) return field;
    }
  }
  return null;
}

/** Minimal RFC4180-ish CSV parse (quoted fields, commas, newlines in quotes). */
export function parseCsvText(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let i = 0;
  let inQuotes = false;
  const s = text.replace(/^\uFEFF/, "");

  while (i < s.length) {
    const ch = s[i]!;
    if (inQuotes) {
      if (ch === '"') {
        if (s[i + 1] === '"') {
          cell += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      cell += ch;
      i += 1;
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      i += 1;
      continue;
    }
    if (ch === ",") {
      row.push(cell);
      cell = "";
      i += 1;
      continue;
    }
    if (ch === "\r") {
      i += 1;
      continue;
    }
    if (ch === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      i += 1;
      continue;
    }
    cell += ch;
    i += 1;
  }
  row.push(cell);
  if (row.some((c) => c.trim() !== "") || rows.length === 0) rows.push(row);
  return rows.filter((r) => r.some((c) => String(c).trim() !== ""));
}

export interface SalesCsvImportResult {
  sales: ComparableSale[];
  mapped: Partial<Record<SalesCsvField, string>>;
  unmappedHeaders: string[];
  skippedRows: number;
  warnings: string[];
}

function newId(): string {
  return `sale-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Convert CSV file text into ComparableSale[].
 * Requires at least an address or sale price column to accept a row.
 */
export function importSalesFromCsv(text: string): SalesCsvImportResult {
  const warnings: string[] = [];
  const table = parseCsvText(text);
  if (table.length < 2) {
    return {
      sales: [],
      mapped: {},
      unmappedHeaders: [],
      skippedRows: 0,
      warnings: ["CSV has no data rows (need a header row and at least one sale)."],
    };
  }

  const headers = table[0]!.map((h) => h.trim());
  const colIndex: Partial<Record<SalesCsvField, number>> = {};
  const mapped: Partial<Record<SalesCsvField, string>> = {};
  const unmappedHeaders: string[] = [];

  headers.forEach((h, idx) => {
    const field = matchField(h);
    if (field && colIndex[field] === undefined) {
      colIndex[field] = idx;
      mapped[field] = h;
    } else if (h) {
      unmappedHeaders.push(h);
    }
  });

  if (colIndex.address === undefined && colIndex.salePrice === undefined) {
    warnings.push(
      "Could not find Address or Sale price columns. Check the CSV header names from RP Data.",
    );
  }

  const sales: ComparableSale[] = [];
  let skippedRows = 0;

  for (let r = 1; r < table.length; r++) {
    const cells = table[r]!;
    const get = (f: SalesCsvField) => {
      const idx = colIndex[f];
      if (idx === undefined) return "";
      return String(cells[idx] ?? "").trim();
    };

    const address = get("address");
    const saleDate = get("saleDate");
    const salePrice = get("salePrice");
    const landArea = get("landArea");
    const comments = get("comments");

    if (!address && !salePrice && !saleDate) {
      skippedRows += 1;
      continue;
    }

    sales.push({
      id: newId(),
      address,
      saleDate,
      salePrice,
      landArea,
      comments,
    });
  }

  if (sales.length === 0) {
    warnings.push("No sale rows could be read from the CSV.");
  }

  return { sales, mapped, unmappedHeaders, skippedRows, warnings };
}
