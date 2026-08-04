import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { CONDITION_SCALE } from "@/lib/inspection/types";
import { cn } from "@/lib/utils";

export function FieldLabel({
  htmlFor,
  children,
  required,
  className,
}: {
  htmlFor?: string;
  children: React.ReactNode;
  required?: boolean;
  className?: string;
}) {
  return (
    <Label htmlFor={htmlFor} className={cn("text-sm font-medium leading-snug", className)}>
      {children}
      {required ? <span className="ml-1 text-destructive">*</span> : null}
    </Label>
  );
}

export function TextInput({
  id,
  value,
  multiline,
  invalid,
  placeholder,
  onChange,
}: {
  id: string;
  value: string;
  multiline?: boolean;
  invalid?: boolean;
  placeholder?: string;
  onChange: (v: string) => void;
}) {
  const shared = cn("h-12 text-base", invalid && "border-destructive");
  if (multiline) {
    return (
      <Textarea
        id={id}
        value={value}
        placeholder={placeholder ?? ""}
        onChange={(e) => onChange(e.target.value)}
        className={cn("min-h-24 text-base", invalid && "border-destructive")}
      />
    );
  }
  return (
    <Input
      id={id}
      value={value}
      placeholder={placeholder ?? ""}
      onChange={(e) => onChange(e.target.value)}
      className={shared}
    />
  );
}

export function SelectInput({
  id,
  value,
  options,
  invalid,
  placeholder = "Select…",
  onChange,
}: {
  id: string;
  value: string;
  options: readonly string[];
  invalid?: boolean;
  placeholder?: string;
  onChange: (v: string) => void;
}) {
  return (
    <Select value={value || undefined} onValueChange={onChange}>
      <SelectTrigger id={id} className={cn("h-12 text-base", invalid && "border-destructive")}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent className="max-h-72">
        {options.map((option) => (
          <SelectItem key={option} value={option} className="text-base">
            {option}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function ConditionSelect({
  id,
  value,
  onChange,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <SelectInput
      id={id}
      value={value}
      options={CONDITION_SCALE}
      placeholder="Condition"
      onChange={onChange}
    />
  );
}

export function CheckboxRow({
  id,
  label,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label
      htmlFor={id}
      className={cn(
        "flex min-h-12 cursor-pointer items-center gap-3 rounded-md border px-3 py-2 text-sm transition-colors",
        checked ? "border-primary bg-primary/5 font-medium" : "border-border hover:bg-muted/60",
      )}
    >
      <Checkbox
        id={id}
        checked={checked}
        onCheckedChange={(v) => onChange(v === true)}
        className="size-5"
      />
      <span className="leading-snug">{label}</span>
    </label>
  );
}
