/**
 * Valuer identity for report letterhead and signature blocks.
 * Selected from prop_assignment when the label contains "Phil" or "Murray".
 *
 * Cover letterhead layout matches the issued sample: centred stacked lines,
 * green title + email, grey body text. Same structure for Phil and Murray.
 */

export type ValuerId = "phil" | "murray" | "default";

export type ValuerProfile = {
  id: ValuerId;
  /** Short name for report meta / insp_valuer */
  displayName: string;
  /**
   * Primary credentials line under company on the cover
   * e.g. "Phillip R Peterson, AVI, Certified Practicing Valuer"
   */
  credentialsLine: string;
  /** Second line: Registered Valuer No. … */
  registrationLine: string;
  /** Membership / designation stored in sign_member when auto-filled */
  membershipLine: string;
  /** Firm name for Firm field (report meta) */
  firm: string;
  /** Company line on letterhead (title case, as on sample) */
  companyLine: string;
  tradingAs: string;
  acn: string;
  abn: string;
  postal: string;
  phone: string;
  mobile: string;
  web: string;
  /** Address part only (no "Email:" prefix) — letterhead adds the label */
  emailAddress: string;
};

const FIRM_META = "PETERSON PROPERTY VALUATIONS PTY LTD";
const COMPANY_LINE = "Peterson Property Valuations Pty Ltd";
const WEB = "www.petersonpropertyvaluations.com.au";
const EMAIL = "petersonpropertyvaluers@gmail.com";
const ACN = "603 599 604";
const ABN = "78 603 599 604";
const TRADING = "Real Estate Valuers";

/** Phillip (Phil) Peterson — details from issued letterhead sample */
export const PHIL_PROFILE: ValuerProfile = {
  id: "phil",
  displayName: "Phillip R Peterson",
  credentialsLine: "Phillip R Peterson, AVI, Certified Practicing Valuer",
  registrationLine: "Registered Valuer No. 1083",
  membershipLine: "AVI, Certified Practicing Valuer — Registered Valuer No. 1083",
  firm: FIRM_META,
  companyLine: COMPANY_LINE,
  tradingAs: TRADING,
  acn: ACN,
  abn: ABN,
  postal: "Postal Address: PO Box 3770 CALOUNDRA WEST QLD 4551",
  phone: "Phone: 07 5357 9196",
  mobile: "Mobile: 0411 514 228",
  web: WEB,
  emailAddress: EMAIL,
};

/** Murray Peterson — same letterhead structure, Murray contact details */
export const MURRAY_PROFILE: ValuerProfile = {
  id: "murray",
  displayName: "Murray Peterson",
  credentialsLine: "Murray Peterson, AVI, Certified Practicing Valuer",
  registrationLine: "Registered Valuer No. 3799",
  membershipLine: "AVI, Certified Practicing Valuer — Registered Valuer No. 3799",
  firm: FIRM_META,
  companyLine: COMPANY_LINE,
  tradingAs: TRADING,
  acn: ACN,
  abn: ABN,
  postal: "Postal Address: PO Box 353, Wilston, QLD, 4051",
  phone: "Phone: 07 3355 1311",
  mobile: "Mobile: 0403 344 425",
  web: WEB,
  emailAddress: EMAIL,
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
  if (t.includes("phil")) return PHIL_PROFILE;
  if (t.includes("murray")) return MURRAY_PROFILE;
  return DEFAULT_VALUER_PROFILE;
}

/** Letterhead fields for the photo cover page (sample layout). */
export function letterheadFromProfile(profile: ValuerProfile) {
  return {
    tradingAs: profile.tradingAs,
    company: profile.companyLine,
    acn: profile.acn,
    abn: profile.abn,
    defaultValuer: profile.credentialsLine,
    defaultRegistration: profile.registrationLine,
    postal: profile.postal,
    phone: profile.phone,
    mobile: profile.mobile,
    web: profile.web,
    emailAddress: profile.emailAddress,
  };
}

export function isPetersonNamedValuer(id: ValuerId): boolean {
  return id === "phil" || id === "murray";
}
