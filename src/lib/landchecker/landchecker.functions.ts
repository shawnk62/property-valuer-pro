import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/**
 * Landchecker live API is disabled — property data is extracted from
 * uploaded Landchecker Property Report PDFs via the app AI settings.
 */
const disabled = () => {
  throw new Error(
    "Landchecker live API is disabled. Upload a Landchecker Property Report PDF on Section 1 and use Extract.",
  );
};

export const landcheckerSuggest = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ query: z.string() }).parse(input))
  .handler(async () => {
    disabled();
    return { suggestions: [] as { id: string; value: string; type: string }[] };
  });

export const landcheckerLookup = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ addressId: z.string() }).parse(input))
  .handler(async () => {
    disabled();
    return {
      fields: {} as Record<string, string>,
      meta: { addressId: "", propertyId: "", fullAddress: "", note: "" },
    };
  });
