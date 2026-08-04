# Phase 1 — QLD Subject Property Inspection Form

Build the on-site inspection wizard driven entirely by your uploaded schema (`inspection_form_schema.json`, v4 — 9 sections, 137 fields), architected so Phases 2–6 (storage, templates, narrative, external data, Word export) drop in without rework.

## What gets built

**Schema-driven wizard** — the JSON is committed as the single source of truth. Field names, labels, and option wording are rendered verbatim; nothing is hardcoded or reworded.

Steps, one per schema section:

```text
1   Property Identification & Inspection Details   (52 fields)
1A  Neighbourhood & Off-site Improvements          (28)
2   Site                                           (12)
3   Building Construction                          (10)
    Special Design / Architectural Features        (3)
3A  Kitchen & Bathrooms (Detailed)                 (13)
4   Building Services                              (5)
5   External Areas, Access, Parking & Ancillary    (4)
6   Overall Condition Summary & Sign-off           (10)
```

**Field renderers**
- `text` — single line or textarea per `multiline`
- `select` — dropdown, options exactly as listed
- `checkbox` — single toggle
- `checkbox_group` — multi-select chips/checkboxes + one shared Condition dropdown + Notes
- `single_row` — Type dropdown + Condition dropdown + Notes on one row
- Condition scale everywhere: Poor, Fair, Average, Good, Very Good, Excellent

**Mobile-first** — large touch targets, sticky step header with progress, sticky Back/Next footer, collapsible subsections so a 52-field step stays workable on a phone. Scales up to a two-column desktop layout.

**Validation** — the schema carries no `required` flags, so I'll add a separate `required.ts` list (editable without touching the schema) starting with: Property Address, Suburb, State, Postcode, Assignment Type, Inspection Date, Inspector/Valuer, and the Overall Condition field in section 6. Next is blocked on the current step; Submit is blocked if any step is incomplete, with a summary linking to each offending step.

**Draft save** — autosaves on every change plus an explicit "Save draft"; resumable after closing the browser.

**Review screen** — full read-only summary grouped by section, each with an Edit link back to that step, then Submit.

**Submit** — produces one flat JSON object keyed by schema field names (checkbox_group as `{selected: [ids], condition, notes}`, single_row as its three child field names). Shown on a confirmation screen with Copy JSON / Download JSON.

**Design** — restrained professional: neutral greys, one deep navy accent, a serif heading face over a clean sans for body/labels. No playful styling.

## Storage decision

Phase 1 saves drafts and submissions to the device (browser storage). Phase 2 turns on Lovable Cloud — the built-in database, logins, and file storage — and migrates records so a phone inspection can be reopened on desktop, and so report templates can be uploaded. Building the data layer behind a small repository module now means Phase 2 swaps the implementation, not the form.

## Technical notes

- `src/data/inspection-schema.json` — your file, committed unchanged; a typed loader parses it.
- `src/lib/inspection/` — types, required-field config, validation, draft repository (localStorage now, Cloud later).
- `src/components/inspection/fields/` — one component per field type.
- Routes: `/` inspections list + New Inspection, `/inspect/$id` the wizard, `/inspect/$id/review`.
- The sample report and the ORIGINAL PDF form are kept as reference material for Phases 3–4; the Greening Place report's section structure (Valuation Summary, Introduction, Property Details, Statutory, Town Planning, Location, Site Details, Improvements 7.1–7.5, Sales Evidence, Remarks) becomes the first template in Phase 3, tagged to Assignment Types.

## Out of scope for this phase

Landchecker/Cotality integrations, template upload, narrative generation, Word export. Nothing here blocks them.
