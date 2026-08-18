import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { lookupByAddressId, suggestAddresses } from "./api";

export const landcheckerSuggest = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ query: z.string().min(1).max(200) }).parse(input),
  )
  .handler(async ({ data }) => {
    const suggestions = await suggestAddresses(data.query);
    return { suggestions };
  });

export const landcheckerLookup = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ addressId: z.string().min(1).max(120) }).parse(input),
  )
  .handler(async ({ data }) => {
    return lookupByAddressId(data.addressId);
  });
