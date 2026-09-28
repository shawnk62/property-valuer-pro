/**
 * Australian English for printed and generated report wording.
 * Does not rename data keys. Leaves trademarks (COLORBOND) and code identifiers alone.
 */

const PAIRS: [string, string][] = [
  ["neighborhoods", "neighbourhoods"],
  ["neighborhood", "neighbourhood"],
  ["analyzing", "analysing"],
  ["analyzed", "analysed"],
  ["analyzes", "analyses"],
  ["analyze", "analyse"],
  ["organizations", "organisations"],
  ["organization", "organisation"],
  ["organizing", "organising"],
  ["organized", "organised"],
  ["organize", "organise"],
  ["favorites", "favourites"],
  ["favorite", "favourite"],
  ["favorable", "favourable"],
  ["favorably", "favourably"],
  ["favored", "favoured"],
  ["favor", "favour"],
  ["colored", "coloured"],
  ["coloring", "colouring"],
  ["aging", "ageing"],
  ["labeled", "labelled"],
  ["labeling", "labelling"],
  ["modeling", "modelling"],
  ["modeled", "modelled"],
  ["traveling", "travelling"],
  ["traveled", "travelled"],
  ["fulfill", "fulfil"],
  ["fulfillment", "fulfilment"],
  ["fibers", "fibres"],
  ["fiber", "fibre"],
  ["grays", "greys"],
  ["gray", "grey"],
  ["catalogs", "catalogues"],
  ["catalog", "catalogue"],
  ["defense", "defence"],
  ["acknowledgment", "acknowledgement"],
  ["practicing", "practising"],
  ["kilometers", "kilometres"],
  ["kilometer", "kilometre"],
];

function swapCase(sample: string, replacement: string): string {
  if (sample === sample.toUpperCase()) return replacement.toUpperCase();
  if (sample[0] === sample[0].toUpperCase()) {
    return replacement.charAt(0).toUpperCase() + replacement.slice(1);
  }
  return replacement;
}

export function australianiseSpelling(input: string): string {
  if (!input) return input;
  let out = input;
  for (const [us, au] of PAIRS) {
    const re = new RegExp(`\\b${us}\\b`, "gi");
    out = out.replace(re, (m) => swapCase(m, au));
  }
  // COLORBOND is a trademark — do not rewrite the brand.
  out = out.replace(/\bColourbond\b/g, "COLORBOND");
  out = out.replace(/\bcolourbond\b/g, "COLORBOND");
  return out;
}
