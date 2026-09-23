import { CaretRight, ShieldCheck } from "@phosphor-icons/react";
import type { SanitizedReport } from "@priemskiyyy/flare";
import type React from "react";

import { Badge } from "src/components/Badge/Badge";
import { formatJson } from "src/formatting/formatJson";

// What Flare's redaction and Ledger's scrubbing write in place of a value.
const REWRITTEN = /(\[Redacted\]|\[email\])/;

type SanitizedPayloadProps = { report: SanitizedReport | null };

export const SanitizedPayload: React.FunctionComponent<
  SanitizedPayloadProps
> = ({ report }) => {
  if (report === null) {
    return (
      <p className="text-sm text-stone-500">
        No payload to show: the console has not received this report.
      </p>
    );
  }

  const parts = formatJson(report).split(REWRITTEN);
  const rewritten = parts.filter((part) => REWRITTEN.test(part)).length;

  return (
    <details className="group rounded-xl border border-stone-200 dark:border-stone-800">
      <summary className="flex cursor-pointer list-none flex-wrap items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium select-none hover:bg-stone-50 dark:hover:bg-stone-800/50 [&::-webkit-details-marker]:hidden">
        <CaretRight
          aria-hidden="true"
          size={14}
          weight="bold"
          className="text-stone-400 transition-transform group-open:rotate-90 motion-reduce:transition-none"
        />
        What every destination received
        {rewritten === 0 ? null : (
          <Badge tone="accent">
            <ShieldCheck aria-hidden="true" size={12} weight="bold" />
            {rewritten} hidden by Flare
          </Badge>
        )}
      </summary>
      <pre
        aria-label="Sanitized payload"
        className="max-h-80 overflow-auto rounded-b-xl border-t border-stone-200 bg-stone-950 p-3 font-mono text-xs leading-relaxed text-stone-200 dark:border-stone-800"
      >
        {parts.map((part, index) => {
          if (!REWRITTEN.test(part)) {
            return part;
          }

          return (
            <mark
              key={index}
              className="rounded bg-amber-300 px-0.5 font-semibold text-stone-950"
            >
              {part}
            </mark>
          );
        })}
      </pre>
    </details>
  );
};
