export const CONDITION_SCALE = [
  "Poor",
  "Fair",
  "Average",
  "Good",
  "Very Good",
  "Excellent",
] as const;

export interface TextField {
  name: string;
  label: string;
  type: "text";
  multiline?: boolean;
  placeholder?: string;
}

/** Long free-text (treated like multiline text in the form). */
export interface TextareaField {
  name: string;
  label: string;
  type: "textarea";
  placeholder?: string;
}

export interface SelectField {
  name: string;
  label: string;
  type: "select";
  options: string[];
}

export interface CheckboxField {
  name: string;
  label: string;
  type: "checkbox";
}

export interface CheckboxGroupItem {
  id: string;
  label: string;
}

export interface CheckboxGroupField {
  name: string;
  label: string;
  type: "checkbox_group";
  items: CheckboxGroupItem[];
  condition_field: string;
  notes_field: string;
}

export interface SingleRowField {
  name: string;
  label: string;
  type: "single_row";
  fields: (TextField | SelectField)[];
}

export type InspectionField =
  | TextField
  | TextareaField
  | SelectField
  | CheckboxField
  | CheckboxGroupField
  | SingleRowField;

export interface InspectionSection {
  id: string;
  title: string;
  fields: InspectionField[];
}

export interface InspectionSchema {
  form_name: string;
  version: string;
  purpose: string;
  condition_scale: string[];
  sections: InspectionSection[];
}

/**
 * Flat answer map. Keys are always schema field names:
 *  - text / select        -> string
 *  - checkbox             -> boolean
 *  - checkbox_group       -> string[] under the group name, plus
 *                            condition_field and notes_field as strings
 *  - single_row           -> each child field name as a string
 */
export type InspectionValues = Record<string, string | boolean | string[] | undefined>;

export type InspectionStatus = "draft" | "submitted";

export interface InspectionRecord {
  id: string;
  status: InspectionStatus;
  values: InspectionValues;
  /** Immutable form answers at submit time (statutory inspection notes). */
  submittedValues?: InspectionValues;
  submittedSchemaVersion?: string;
  createdAt: string;
  updatedAt: string;
  submittedAt?: string;
  schemaVersion: string;
}
