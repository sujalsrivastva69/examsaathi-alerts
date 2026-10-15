import type { ReactNode } from "react";

export function ToolPanel({
  children,
  className = "",
  "aria-live": ariaLive,
}: {
  children: ReactNode;
  className?: string;
  "aria-live"?: "off" | "polite" | "assertive";
}) {
  return (
    <section aria-live={ariaLive} className={`rounded-2xl border border-line bg-white p-5 shadow-card sm:p-7 ${className}`}>
      {children}
    </section>
  );
}

export function ToolField({
  label,
  id,
  children,
  hint,
}: {
  label: string;
  id: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-semibold text-ink">
        {label}
      </label>
      {hint && <p id={`${id}-hint`} className="mt-1 text-xs leading-5 text-muted">{hint}</p>}
      <div className="mt-2">{children}</div>
    </div>
  );
}

export const inputClass =
  "block w-full rounded-lg border border-line bg-white px-3 py-2.5 text-sm text-ink shadow-sm focus:border-forest focus:outline-none focus:ring-2 focus:ring-forest/20";

export const buttonClass =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-forest px-4 py-2.5 text-sm font-semibold text-white hover:bg-forest-dark focus:outline-none focus-visible:ring-2 focus-visible:ring-forest focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";

export const secondaryButtonClass =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-line bg-white px-4 py-2.5 text-sm font-semibold text-forest hover:bg-mint focus:outline-none focus-visible:ring-2 focus-visible:ring-forest focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";
