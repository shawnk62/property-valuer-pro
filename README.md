# Property Valuer Pro

Project: Queensland Valuation Report App (MVP)

What we are building

A professional web app for Queensland Registered Valuers that:

Captures a structured subject property inspection on site (phone/iPad friendly).

Pulls in title, zoning, overlays, lot details from Landchecker (or similar).

Pulls in comparable sales from Cotality / RP Data (or similar).

Uses the inspection data + external data to automatically draft as much of a formal valuation report as possible.

Produces different report formats depending on the purpose of the valuation (Assignment Type).

Lets the valuer easily upload and manage sample report templates so new report types can be added later without code changes.

The finished report must be professional enough for use in part-share sales, stamp duty, mortgage, ATO/CGT, resumption, and dispute work in Queensland.

Core concepts (read carefully)

A. Inspection Form (Subject Property Data Capture)

We already have a complete field schema (JSON).
Use that schema exactly for field names, labels, types, and options.
Do not invent extra fields and do not change option wording — the phrases are designed for narrative export.

Key behaviour already defined:

Multi-step wizard (one step per section in the schema).

checkbox_group = multi-select + shared Condition dropdown + Notes.

single_row = Type dropdown + Condition dropdown + Notes.

Condition scale everywhere: Poor, Fair, Average, Good, Very Good, Excellent.

Validation that blocks “Next” / “Submit” if required fields on the current (or any) step are incomplete.

Save draft + Review screen before final submit.

On submit, store everything as one JSON object using the schema field names as keys.

The inspection form is the single source of truth for the physical description of the subject property.

B. Assignment Type drives report format

The form contains an Assignment Type dropdown (examples already in schema: Purchase, Refinance, ATO / CGT, Resumption, Dispute, Other).

Rule:
When the user selects an Assignment Type, the app must choose the matching report template.
Different purposes require different section order, different emphasis, and sometimes different mandatory paragraphs.

C. Sample Report Templates (user-manageable)

Admin (or the valuer) can upload sample valuation reports (Word or PDF) and tag them with one or more Assignment Types.

The app stores these samples and uses them as the structural + stylistic reference when generating a new report of that type.

It must be easy to add, replace, or retire a sample later without developer involvement.

For the MVP we can start with one sample (the attached “part share / stamp duty” report) and leave the upload UI ready for more.

D. External data sources

1. Landchecker (or equivalent)
Purpose: auto-fill title, zoning, overlays, hazards, lot size, legal description, etc.

Desired data (map into our form / report fields where possible):

Lot / Plan, Title Reference, Legal Description

Land size, frontage, orientation

Zoning classification + zoning description

Planning overlays

Flood, bushfire, other hazards

Local Government Area

MVP approach:

Primary: address search → call Landchecker Property Details / Planning API (JSON) if credentials are available.

Fallback: manual paste or CSV / PDF upload of a Landchecker report that the user then confirms.

2. Cotality / RP Data (or equivalent)
Purpose: comparable sales evidence.

Desired data per comparable:

Address, sale price, sale date

Land area, floor area, beds / baths / cars

Year built, property type

Distance from subject

Any available notes / attributes

MVP approach:

Primary: search / import from Cotality API or export file if available.

Fallback: CSV upload or manual entry of comparables, with a clean table UI so the valuer can select which sales go into the report.

Both integrations should be designed so that:

The valuer can always override or edit imported data.

Missing credentials do not block the rest of the app (graceful fallback to manual entry).

Report generation flow

Valuer completes (or partially completes) the inspection form.

Optionally imports Landchecker data for the subject.

Optionally imports / selects comparable sales from Cotality.

Selects Assignment Type.

App loads the matching sample report template.

App generates draft narrative sections by combining:

Structured inspection JSON

Landchecker data

Selected comparables

The style and section structure of the chosen sample template

Valuer reviews and edits the draft in a clean editor.

App produces a downloadable Word (and optionally PDF) report.

Sections the inspection data should heavily feed

(From the sample report structure)

Valuation Summary – Description paragraph

Location / Neighbourhood

Site Details (physical description, services, flood, etc.)

Improvements

7.1 General Description

7.2 General Construction

7.3 Accommodation Details

7.4 Ancillary Improvements

7.5 Condition of Improvements

Parts of Remarks / Assessment that describe the subject

Other sections (Introduction, Basis of Valuation, Limitations, Critical Assumptions, Sales Evidence commentary, etc.) should be driven mainly by the chosen template + Assignment Type, with light insertion of subject-specific facts where appropriate.

Technical preferences for Lovable

Mobile-first for the inspection form (valuers work on site).

Desktop-friendly for report review and comparable selection.

Clean professional UI, no playful styling.

All form answers stored as structured JSON (the schema field names are the contract).

Report templates stored so new samples can be uploaded later.

Clear separation of:

Inspection data

External property data (Landchecker)

Comparable sales data

Report templates

Generated report drafts

What success looks like for this MVP

A valuer can complete an inspection on a phone and save a clean JSON record.

The same record can be opened on desktop, enriched with Landchecker + Cotality data, and turned into a first-draft valuation report whose structure matches the selected Assignment Type.

Adding a new report type later only requires uploading a new sample and tagging it — not rewriting the app.

The field names and option lists stay stable so we can later extract the whole system into a standalone production app.

Immediate build order (suggested)

Phase 1 – Inspection form
Build the multi-step form exactly from the JSON schema (with validation, draft save, review screen).

Phase 2 – Data model & storage
Store inspection submissions, allow list / open / edit.

Phase 3 – Report templates
Upload the provided sample report, tag it to Assignment Type(s), and create a simple template manager.

Phase 4 – Narrative draft
Generate the subject-description sections of the report from the inspection JSON + template.

Phase 5 – External data
Landchecker address lookup (with manual fallback) and Cotality / CSV comparable sales import.

Phase 6 – Full report assemble & download
Merge everything into a downloadable Word document.

Start with Phase 1. Keep the architecture open for the later phases.

I have the json file for the inspection form and a copy of the template for the inspection form, but have not been able to attach them. I have attached a sample of a valuation report that was done for the purpose of estimating the value for a dissolution of marriage as a place to start, but there will be other formats for different types of reports. The information captured by the inspection form will be used for all types.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/b1169652-b3e2-4281-8440-33b06162983f).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
