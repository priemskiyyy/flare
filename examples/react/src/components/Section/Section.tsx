import { Lightbulb } from "@phosphor-icons/react";
import type React from "react";
import type { ReactNode } from "react";

import type { SectionId } from "src/types/SectionId";
import { SECTIONS } from "src/utils/constants/sections";

type SectionProps = { id: SectionId; hint: string; children: ReactNode };

export const Section: React.FunctionComponent<SectionProps> = ({
  id,
  hint,
  children,
}) => {
  const { number, title } = SECTIONS[id];

  return (
    <section
      id={id}
      aria-labelledby={`${id}-title`}
      className="flex scroll-mt-32 flex-col gap-4"
    >
      <header className="flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <span
            aria-hidden="true"
            className="flex size-8 shrink-0 items-center justify-center rounded-full bg-amber-600 font-mono text-base font-semibold text-white tabular-nums dark:bg-amber-400 dark:text-stone-950"
          >
            {number}
          </span>
          <h2
            id={`${id}-title`}
            className="text-xl font-semibold tracking-tight sm:text-2xl"
          >
            {title}
          </h2>
        </div>
        <p className="flex max-w-4xl items-start gap-2 text-base leading-relaxed text-stone-600 dark:text-stone-400">
          <Lightbulb
            aria-hidden="true"
            size={20}
            weight="duotone"
            className="mt-0.5 shrink-0 text-amber-600 dark:text-amber-400"
          />
          <span>
            <span className="font-semibold text-stone-800 dark:text-stone-200">
              Try this:
            </span>{" "}
            {hint}
          </span>
        </p>
      </header>
      {children}
    </section>
  );
};
