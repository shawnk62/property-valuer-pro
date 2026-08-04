# Petrol generator, auto-filled sign-off, and the Review button

## 1. Add "Petrol generator" to Auxiliary Power

Section 4 (Building Services) has the "Auxiliary Power & Emergency Lighting" tick list, currently: Diesel generator, Gas generator, UPS battery backup, Maintained emergency lighting, Non-maintained emergency lighting, Solar with battery backup, None, Other.

Add `Petrol generator` directly after `Diesel generator`, so the three generator types sit together at the top of the list. The new item keeps the same id convention (`aux_petrol`).

## 2. Valuer name and date carry through to sign-off

Section 1 captures **Inspection Date** and **Valuer**. Section 6 (Overall Condition Summary & Sign-off) asks again for **Valuer Name** and **Date**.

Behaviour: the sign-off fields pre-fill from the Section 1 values, and stay in sync while they haven't been edited by hand. If the valuer types something different into the sign-off field, that manual entry wins and is no longer overwritten. Both remain fully editable.

## 3. Review button

The Review button on the last step is wired to the review screen and the route resolves correctly, so the wizard should navigate. The most likely reason it appears to do nothing: the last step (Section 6) has a required field — **Overall Condition** — and when it's blank the wizard blocks navigation and shows an error toast instead. If the toast isn't visible on that screen, it reads as a dead button.

Steps:
- Reproduce the last step in the running app with the field blank and with it filled, and confirm what actually happens.
- If it is the validation block: keep the block but make the reason obvious on-page (the inline "Required on this step" panel scrolls into view and the field is highlighted) rather than relying on a toast alone.
- If navigation is genuinely failing, fix the navigation itself.

Either way this gets verified against the live app, not assumed — it will work in the real build.

## Technical notes

- `src/data/inspection-schema.json`: insert the `aux_petrol` item in the `aux` group.
- Sign-off propagation lives in the form layer (a small derived-default rule in the inspection hook / field renderer keyed on `insp_valuer -> sign_name` and `insp_date -> sign_date`), with a "touched" check so manual edits are never clobbered. No schema change.
- Review flow: `src/routes/inspect.$id.tsx` `goNext()` — verify via a scripted browser run against the preview, then adjust error surfacing or navigation as the run shows.
