# Keep the wide layout, make tick box order read logically

The underlying order already matches your schema exactly (e.g. Fencing runs ... Picket fencing, Two wire, Three wire, Four wire, Five wire, Star picket, Timber post, Concrete post ...). What breaks it visually is the 2/3-column grid filling **row by row**: consecutive options land in different columns and rows, so related items like the wire counts and the post types end up separated across the grid.

## Changes

- Keep the current wide multi-column format.
- Change the checkbox-group grid to **column flow**: reading straight down column 1, then column 2, then column 3 follows schema order, so runs like Two/Three/Four/Five wire and Timber/Concrete post stay adjacent.
- Where a group has clear runs (fence materials, wire counts, post types, boundary locations, gates), add lightweight subgroup headings inside the group so each run is visually kept together and each starts on its own line. Headings are presentational only — no field names, labels, option wording, or values change.
- Review screen and exported JSON list ticked items in schema order rather than tap order.

## Technical notes

- `src/components/inspection/fields/FieldRenderer.tsx`: replace the row-flow grid (`grid gap-2 sm:grid-cols-2 lg:grid-cols-3`, line 155) with a CSS multi-column / `grid-flow-col` layout with balanced column count, plus optional per-run blocks driven by a small presentational grouping map keyed by field name and item id.
- Selection toggle rebuilds the array by filtering `field.items` in schema order, so `itemLabels` output on review follows the form order.
