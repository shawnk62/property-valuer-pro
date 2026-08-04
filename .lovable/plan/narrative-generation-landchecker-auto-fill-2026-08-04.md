# Narrative generation + Landchecker auto-fill

Two additions on top of the working inspection wizard: an AI narrative writer that runs automatically after submit, and a paste/upload path that fills Section 1 from a Landchecker export.

Answer to your question: no — nothing currently pulls from Landchecker. Section 1 is manual entry only. Landchecker has no public self-serve API, so this plan uses their export (paste text or drop the PDF) as the input, which needs no vendor agreement and works today.

## 1. LLM settings (your own keys)

A Settings screen where you choose:

- Provider: OpenAI, Google (Gemini), or Anthropic — these are the providers supported by the Lovable AI Gateway. Grok / xAI is not supported by the gateway, so it cannot be selected here.
- Model: list per provider, editable free-text so a new model name works without an app update
- API key for that provider

If you specifically need Grok, the only path is a separate "Custom OpenAI-compatible endpoint" option where you supply the xAI base URL (`https://api.x.ai/v1`) and model name (e.g. `grok-3-latest`) plus your xAI key. That call bypasses the Lovable AI Gateway entirely and goes straight to xAI from the server function. It works, but it is not the default flow and won't share gateway logging or billing.

The choice is saved and becomes the default for every future report until you change it. Keys stay on the device you enter them on and are sent only to the provider you selected — never stored in a shared database, never shown in the report or exports. A "Test connection" button confirms the key works before you rely on it. If no key is configured, the app says so plainly at submit instead of failing silently.

## 2. Narrative generation

Trigger: submitting an inspection. Generation starts immediately in the background — you can leave the report screen and come back; progress is shown per block.

Output: separate narrative blocks keyed to report sections, matching the sample report's structure:

```text
Location & Neighbourhood      <- section 1A
Site Details                  <- section 2
Improvements — Construction   <- sections 3 + special features
Improvements — Internal       <- section 3A kitchen/bathrooms
Building Services             <- section 4
External Areas & Ancillary    <- section 5
Overall Condition & Remarks   <- section 6
```

Each block:
- shows Pending / Writing / Done / Failed
- is fully editable in place, with edits kept over regeneration
- has its own Regenerate button, so one weak paragraph doesn't mean redoing the lot
- records which model wrote it and when

Tone and content are driven by the Assignment Type on the form, so a mortgage security report reads differently from a family law or resumption report. The prompt is built strictly from the answers you gave — the model is instructed to describe only what was recorded, never to invent measurements, materials or values, and to omit anything not captured rather than guess.

Failures (bad key, rate limit, no credit, provider outage) surface as a clear message on the affected block with a retry, not a blank paragraph.

## 3. Landchecker / Cotality auto-fill

On a new inspection, an "Import property data" panel above Section 1:

- paste a Landchecker (or similar) property summary, or drop the PDF
- the **same LLM provider and model selected for narrative generation** extracts Address, Suburb, State, Postcode, Lot/Plan, Title Reference, Legal Description, LGA, land area, zoning and any other Section 1 fields present
- results are shown as a side-by-side review — existing value vs extracted value — and nothing is written until you accept, per field or all at once
- every imported field is tagged with its source so it's clear what came from the import versus your own entry

The extractor sits behind an adapter interface, so when real Landchecker or Cotality API credentials become available, that becomes another source feeding the same review step with no change to the form. The extraction prompt is lightweight and separate from the narrative prompts, but it runs through the same provider helper so there is only one key and one model to configure.

## Technical notes

- `src/lib/ai/` — provider registry (OpenAI / Anthropic / Google), settings persistence, key handling.
- Provider calls go through a server function so the browser isn't blocked by provider CORS; the key is passed per request and never logged or persisted server-side.
- `src/lib/narrative/` — section-to-block mapping, prompt builders per Assignment Type, block state machine (pending/writing/done/failed/edited).
- Narrative blocks are stored on the inspection record alongside `values`, so the Phase 2 Cloud migration and Phase 6 Word export both pick them up unchanged.
- `src/lib/import/` — extraction adapter + Landchecker text/PDF adapter, returning a field-name-keyed candidate map for the review step.
- New routes: `/settings` (LLM config), narrative blocks rendered on the existing review screen.

## Not in this phase

Word/PDF export of the narrative, template management, live Landchecker/Cotality API connections, Cloud storage migration. Each of those slots into what this builds.
