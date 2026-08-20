import { useState } from "react";
import { format, isValid, parse } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

/** Parse stored AU DD/MM/YYYY (or ISO) into a Date for the calendar. */
export function parseInspectionDate(raw: string): Date | undefined {
  const s = raw.trim();
  if (!s) return undefined;
  for (const pattern of ["dd/MM/yyyy", "d/M/yyyy", "yyyy-MM-dd", "dd-MM-yyyy"]) {
    const d = parse(s, pattern, new Date());
    if (isValid(d)) return d;
  }
  const native = new Date(s);
  return isValid(native) ? native : undefined;
}

export function formatInspectionDate(d: Date): string {
  return format(d, "dd/MM/yyyy");
}

interface DatePickerFieldProps {
  id: string;
  value: string;
  invalid?: boolean;
  onChange: (value: string) => void;
}

/** Interactive calendar popover; value stored as DD/MM/YYYY. */
export function DatePickerField({ id, value, invalid, onChange }: DatePickerFieldProps) {
  const [open, setOpen] = useState(false);
  const selected = parseInspectionDate(value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          className={cn(
            "h-10 w-full justify-start text-left font-normal",
            !value && "text-muted-foreground",
            invalid && "border-destructive ring-1 ring-destructive",
          )}
        >
          <CalendarIcon className="mr-2 size-4 shrink-0 opacity-70" />
          {value.trim() ? value : "Select date"}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={selected}
          defaultMonth={selected ?? new Date()}
          captionLayout="dropdown"
          startMonth={new Date(1990, 0)}
          endMonth={new Date(new Date().getFullYear() + 2, 11)}
          onSelect={(d) => {
            if (d) {
              onChange(formatInspectionDate(d));
              setOpen(false);
            }
          }}
        />
        {value.trim() ? (
          <div className="border-t p-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="w-full"
              onClick={() => {
                onChange("");
                setOpen(false);
              }}
            >
              Clear date
            </Button>
          </div>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}
