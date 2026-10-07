import { useEffect, useRef, useState } from "react";

/**
 * Keeps keystrokes in the field. The report updates after a short pause or when
 * the field is left, so a long job is not rebuilt on every letter.
 */
export function PausedTextarea({
  value,
  onCommit,
  className,
  rows,
  placeholder,
  onFocus,
}: {
  value: string;
  onCommit: (value: string) => void;
  className?: string;
  rows?: number;
  placeholder?: string;
  onFocus?: () => void;
}) {
  const [text, setText] = useState(value);
  const latest = useRef(value);
  const focused = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const commitRef = useRef(onCommit);
  commitRef.current = onCommit;

  useEffect(() => {
    if (focused.current) return;
    latest.current = value;
    setText(value);
  }, [value]);

  function commit(next: string) {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    commitRef.current(next);
  }

  return (
    <textarea
      value={text}
      rows={rows}
      placeholder={placeholder}
      className={className}
      onFocus={() => {
        focused.current = true;
        onFocus?.();
      }}
      onChange={(e) => {
        const next = e.target.value;
        latest.current = next;
        setText(next);
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => commit(next), 500);
      }}
      onBlur={() => {
        focused.current = false;
        commit(latest.current);
      }}
    />
  );
}
