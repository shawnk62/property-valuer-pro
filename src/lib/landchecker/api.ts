/**
 * Landchecker public JSON API (trial / free endpoints).
 * Base: https://api.landchecker.com.au
 *
 * What works without a paid plan:
 *  - address suggestions
 *  - address → property_id
 *  - basic property details (address, LGA, lot/plan)
 *
 * Zones, overlays, land area, hazards, and map imagery require
 * authenticated product access the current test key does not unlock.
 */

const BASE = "https://api.landchecker.com.au";

export type LandcheckerSuggestion = {
  id: string;
  value: string;
  type: string;
};

export type LandcheckerMappedFields = Record<string, string>;

function authHeaders(): HeadersInit {
  const key =
    (typeof process !== "undefined" && process.env.LANDCHECKER_API_KEY?.trim()) ||
    (typeof process !== "undefined" && process.env.LANDCHECKER_TEST_KEY?.trim()) ||
    "";
  const headers: Record<string, string> = {
    Accept: "application/json",
  };
  if (key) {
    headers.Authorization = `Bearer ${key}`;
  }
  return headers;
}

async function lcGet(path: string): Promise<unknown> {
  const res = await fetch(`${BASE}${path}`, {
    method: "GET",
    headers: authHeaders(),
  });
  const text = await res.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }
  if (!res.ok) {
    const msg =
      (json && typeof json === "object" && "error" in json && String((json as { error: unknown }).error)) ||
      (json &&
        typeof json === "object" &&
        "errors" in json &&
        Array.isArray((json as { errors: unknown }).errors) &&
        String(((json as { errors: { title?: string }[] }).errors[0] as { title?: string })?.title)) ||
      `Landchecker HTTP ${res.status}`;
    throw new Error(msg);
  }
  return json;
}

export async function suggestAddresses(query: string): Promise<LandcheckerSuggestion[]> {
  const q = query.trim();
  if (q.length < 3) return [];
  const data = (await lcGet(`/api/v1/suggestions/search?q=${encodeURIComponent(q)}`)) as {
    data?: LandcheckerSuggestion[];
  };
  return Array.isArray(data?.data) ? data.data : [];
}

type AddressPayload = {
  address?: {
    id?: string;
    property_id?: string;
    full_address?: string;
    line_one?: string;
    line_two?: string;
    geojson?: { geometry?: { coordinates?: number[] } };
  };
};

type DetailsPayload = {
  property?: {
    address_line_one?: string;
    address_line_two?: string;
    address_full?: string;
    address_state?: string;
    local_government?: string;
    council_property_number?: string | null;
    parcels?: Array<{
      id?: string;
      standard_parcel_id?: string;
      description?: string;
      identifiers?: Array<{
        type?: string;
        description?: string;
        lot_number?: string | null;
        plan_number?: string | null;
      }>;
    }>;
  };
};

/** Parse " Runcorn Qld 4113" / "RUNCORN QLD 4113" into suburb + postcode. */
export function parseLocalityLine(lineTwo: string | undefined | null): {
  suburb: string;
  state: string;
  postcode: string;
} {
  const raw = String(lineTwo ?? "").replace(/^[\s,]+/, "").trim();
  if (!raw) return { suburb: "", state: "", postcode: "" };

  const postcodeMatch = raw.match(/\b(\d{4})\s*$/);
  const postcode = postcodeMatch?.[1] ?? "";
  let rest = postcode ? raw.slice(0, postcodeMatch!.index).trim() : raw;

  const stateMatch = rest.match(/\b(QLD|NSW|VIC|SA|WA|TAS|ACT|NT)\b/i);
  const state = stateMatch?.[1]?.toUpperCase() ?? "";
  if (stateMatch) {
    rest = rest.replace(stateMatch[0], "").replace(/,+/g, " ").trim();
  }

  // Title-case suburb words
  const suburb = rest
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");

  return { suburb, state, postcode };
}

function titleCaseLga(raw: string): string {
  return raw
    .split(/\s+/)
    .map((w) => {
      const lower = w.toLowerCase();
      if (["of", "and", "the"].includes(lower)) return lower;
      return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
    })
    .join(" ");
}

export async function lookupByAddressId(addressId: string): Promise<{
  fields: LandcheckerMappedFields;
  meta: {
    addressId: string;
    propertyId: string;
    fullAddress: string;
    note: string;
  };
}> {
  const addrJson = (await lcGet(`/api/v1/addresses/${encodeURIComponent(addressId)}`)) as AddressPayload;
  const addr = addrJson?.address;
  if (!addr?.property_id) {
    throw new Error("Landchecker did not return a property for that address.");
  }

  const detailsJson = (await lcGet(
    `/api/v1/properties/${encodeURIComponent(addr.property_id)}/details`,
  )) as DetailsPayload;
  const p = detailsJson?.property ?? {};

  const lineOne = (p.address_line_one || addr.line_one || "").trim();
  const lineTwo = p.address_line_two || addr.line_two || "";
  const { suburb, state: parsedState, postcode } = parseLocalityLine(lineTwo);
  const state = (p.address_state || parsedState || "QLD").toUpperCase();

  const parcel = p.parcels?.[0];
  const lotPlan =
    parcel?.standard_parcel_id ||
    parcel?.identifiers?.find((i) => i.type === "lot_plan")?.description ||
    parcel?.description ||
    "";

  const fields: LandcheckerMappedFields = {};
  if (lineOne) fields.prop_address = lineOne;
  if (suburb) fields.prop_suburb = suburb;
  if (state) fields.prop_state = state;
  if (postcode) fields.prop_postcode = postcode;
  if (p.local_government) fields.prop_lga = titleCaseLga(p.local_government);
  if (lotPlan) fields.prop_lotplan = lotPlan;
  if (parcel?.description) fields.prop_legal = parcel.description;

  return {
    fields,
    meta: {
      addressId: addr.id || addressId,
      propertyId: addr.property_id,
      fullAddress: p.address_full || addr.full_address || `${lineOne}, ${lineTwo}`.trim(),
      note:
        "Trial data includes address, LGA and lot/plan only. Zoning, overlays, site area and maps require full Landchecker product access.",
    },
  };
}
