import type { ComparableSale } from "./types";

/**
 * Sample SE QLD sales used by the mock "Import from Cotality" action.
 * Replace with a real Cotality/CoreLogic response at integration.
 */
export const MOCK_COTALITY_SALES: Omit<ComparableSale, "id">[] = [
  {
    address: "14 Kuranda Street, Buderim QLD 4556",
    saleDate: "18/04/2026",
    salePrice: "$1,062,000",
    landArea: "612 m²",
    comments:
      "Lowset rendered block and tile, 4 bed 2 bath 2 car. Renovated kitchen and bathrooms. Superior land area and improvement size; considered superior overall.",
  },
  {
    address: "6 Wirraway Court, Sippy Downs QLD 4556",
    saleDate: "02/04/2026",
    salePrice: "$928,000",
    landArea: "455 m²",
    comments:
      "Lowset brick and tile, 4 bed 2 bath 2 car, circa 2004. Original kitchen. Comparable land area, slightly larger improvements; broadly comparable.",
  },
  {
    address: "23 Hinterland Drive, Mountain Creek QLD 4557",
    saleDate: "21/03/2026",
    salePrice: "$895,000",
    landArea: "440 m²",
    comments:
      "Lowset brick and tile, 3 bed 2 bath 2 car with inground pool. Direct comparison to subject; considered slightly superior for pool.",
  },
  {
    address: "8 Nardoo Place, Sippy Downs QLD 4556",
    saleDate: "07/03/2026",
    salePrice: "$860,000",
    landArea: "421 m²",
    comments:
      "Lowset brick and tile, 3 bed 2 bath 2 car, circa 2001. Dated wet areas. Considered marginally inferior to the subject.",
  },
  {
    address: "31 Lomond Crescent, Buderim QLD 4556",
    saleDate: "26/02/2026",
    salePrice: "$975,000",
    landArea: "506 m²",
    comments:
      "Highset rendered block, 4 bed 2 bath, elevated with district outlook. Superior aspect and outlook; superior overall.",
  },
  {
    address: "12 Bellingham Avenue, Mountain Creek QLD 4557",
    saleDate: "12/02/2026",
    salePrice: "$842,000",
    landArea: "398 m²",
    comments:
      "Lowset brick and tile, 3 bed 2 bath 1 car. Smaller site and single lock-up garage; inferior to the subject.",
  },
  {
    address: "5 Yarrimbah Court, Sippy Downs QLD 4556",
    saleDate: "30/01/2026",
    salePrice: "$905,000",
    landArea: "468 m²",
    comments:
      "Lowset brick and tile, 3 bed 2 bath 2 car with covered alfresco and shed. Considered a close comparison to the subject property.",
  },
];
