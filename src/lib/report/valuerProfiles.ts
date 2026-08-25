/**
 * Valuer identity for report letterhead and signature blocks.
 * Selected from prop_assignment when the label contains "Phil" or "Murray".
 */

export type ValuerId = "phil" | "murray" | "default";

export type ValuerProfile = {
  id: ValuerId;
  /** Short name for report meta / insp_valuer */
  displayName: string;
  /**
   * Primary credentials line under company on the cover
   * e.g. "Phil Peterson, AAVI, Certified Practicing Valuer No. 1083"
   */
  credentialsLine: string;
  /**
   * Optional second line (Murray registration). Empty for Phil.
   */
  registrationLine: string;
  /**
   * Membership / designation stored in sign_member when auto-filled.
   */
  membershipLine: string;
  /** Firm name for Firm field and letterhead company line */
  firm: string;
  tradingAs: string;
  acn: string;
  abn: string;
  postal: string;
  phone: string;
  mobile: string;
  web: string;
  email: string;
};

const FIRM = "PETERSON PROPERTY VALUATIONS PTY LTD";
const WEB = "www.petersonpropertyvaluations.com.au";
const EMAIL = "petersonpropertyvaluers@gmail.com";
const ACN = "603 599 604";
const ABN = "78 603 599 604";
const TRADING = "Real Estate Valuers";

/** Phillip (Phil) Peterson — Phil report types */
export const PHIL_PROFILE: ValuerProfile = {
  id: "phil",
  displayName: "Phil Peterson",
  credentialsLine: "Phil Peterson, AAVI, Certified Practicing Valuer No. 1083",
  registrationLine: "",
  membershipLine: "AAVI, Certified Practicing Valuer No. 1083",
  firm: FIRM,
  tradingAs: TRADING,
  acn: ACN,
  abn: ABN,
  postal: "",
  phone: "",
  mobile: "Mobile: 0411 514 228",
  web: WEB,
  email: `Email: ${EMAIL}`,
};

/** Murray Peterson — Murray report types (also legacy default letterhead) */
export const MURRAY_PROFILE: ValuerProfile = {
  id: "murray",
  displayName: "Murray Peterson",
  credentialsLine: "Murray Peterson, AVI, Certified Practicing Valuer",
  registrationLine: "Registered Valuer No. 3799",
  membershipLine: "AVI, Certified Practicing Valuer — Registered Valuer No. 3799",
  firm: FIRM,
  tradingAs: TRADING,
  acn: ACN,
  abn: ABN,
  postal: "Postal Address: PO Box 353, Wilston, QLD, 4051",
  phone: "Phone: 07 3355 1311",
  mobile: "Mobile: 0403 344 425",
  web: WEB,
  email: `Email: ${EMAIL}`,
};

/** Fallback when assignment is neither Phil nor Murray */
export const DEFAULT_VALUER_PROFILE: ValuerProfile = {
  ...MURRAY_PROFILE,
  id: "default",
};

/**
 * Resolve valuer from Report Type (prop_assignment) text.
 * - contains "phil" → Phil Peterson
 * - contains "murray" → Murray Peterson
 * - otherwise → default (Murray letterhead details)
 */
export function resolveValuerProfile(
  propAssignment: string | null | undefined,
): ValuerProfile {
  const t = (propAssignment || "").toLowerCase();
  if (/\bphil\b/i.test(t) || t.includes("phil")) return PHIL_PROFILE;
  if (/\bmurray\b/i.test(t) || t.includes("murray")) return MURRAY_PROFILE;
  return DEFAULT_VALUER_PROFILE;
}

/** Letterhead fields for the photo cover page */
export function letterheadFromProfile(profile: ValuerProfile) {
  return {
    tradingAs: profile.tradingAs,
    company: profile.firm,
    acn: profile.acn,
    abn: profile.abn,
    defaultValuer: profile.credentialsLine,
    defaultRegistration: profile.registrationLine,
    postal: profile.postal,
    phone: profile.phone,
    mobile: profile.mobile,
    web: profile.web,
    email: profile.email,
  };
}

export function isPetersonNamedValuer(id: ValuerId): boolean {
  return id === "phil" || id === "murray";
}
