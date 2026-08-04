# Restore original tick box order

Nothing in the code re-sorts the options — the schema order is preserved — but two things make the order *look* changed:

1. **Multi-column grid layout.** Tick boxes inside a checkbox group are laid out in 2 columns (tablet) and 3 columns (desktop), filling left-to-right, row by row. So a list that reads 1,2,3,4,5,6 top-to-bottom on the form appears as 1,2,3 / 4,5,6 across rows — visually a different sequence from the original single-column form.
2. **Review screen lists ticked items in click order.** Selected items are stored in the order you tapped them, so the summary can list them out of form order.

## Changes

- Render every checkbox group as a single vertical column, in exact schema order, on all screen sizes — matching the original form's top-to-bottom sequence. (Optional alternative if you prefer wider layouts: keep multiple columns but use column-flow so reading down each column preserves the order.)
- On the review screen and in the exported JSON, list ticked items in schema order rather than tap order.
- No changes to field names, labels, option wording, or which fields exist.

## Technical notes

- `src/components/inspection/fields/FieldRenderer.tsx`: drop `sm:grid-cols-2 lg:grid-cols-3` on the checkbox-group item grid (line 155) so items stack in one column.
- Selection normalisation: when toggling, rebuild the selected array by filtering `field.items` in schema order instead of appending; review rendering then follows automatically via `itemLabels`.
