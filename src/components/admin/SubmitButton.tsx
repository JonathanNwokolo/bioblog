"use client";

import { useFormStatus } from "react-dom";

interface SubmitButtonProps {
  children: React.ReactNode;
  pendingLabel?: string;
  className?: string;
}

/** Disables itself while its form's Server Action runs, so a double click cannot submit twice. */
export function SubmitButton({ children, pendingLabel = "Processando…", className = "btn btn--outline" }: SubmitButtonProps) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={className} disabled={pending} aria-disabled={pending}>
      {pending ? pendingLabel : children}
    </button>
  );
}
