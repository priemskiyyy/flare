import { Flask, Lightning } from "@phosphor-icons/react";
import type React from "react";

import { buttonStyles } from "examples/shared/ui/styles/buttonStyles";
import { HeroStep } from "src/components/Hero/HeroStep";
import { scrollToElement } from "src/utils/scrollToElement";

export const Hero: React.FunctionComponent = () => (
  <section
    aria-label="Overview"
    className="grid gap-6 rounded-3xl border border-amber-200 bg-linear-to-br from-amber-50 via-amber-50/70 to-rose-50/60 p-6 sm:p-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:items-center dark:border-amber-900/60 dark:from-amber-950/30 dark:via-stone-950 dark:to-rose-950/20"
  >
    <div className="flex flex-col gap-4">
      <p className="font-mono text-sm font-semibold tracking-widest text-amber-700 uppercase dark:text-amber-300">
        A Flare demo
      </p>
      <h2 className="text-3xl font-semibold tracking-tight text-balance sm:text-5xl">
        Error reports you can account for
      </h2>
      <p className="max-w-2xl text-base leading-relaxed text-stone-600 sm:text-lg dark:text-stone-400">
        Ledger is a small invoicing app that reports its errors through Flare to
        five destinations: your API, the console, Sentry, PostHog and Datadog.
        All of them run inside this page, so nothing leaves your browser.
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => scrollToElement("app")}
          className={buttonStyles({ variant: "primary" })}
        >
          <Lightning aria-hidden="true" size={16} weight="bold" />
          Make something fail
        </button>
        <button
          type="button"
          onClick={() => scrollToElement("lab")}
          className={buttonStyles({ variant: "ghost" })}
        >
          <Flask aria-hidden="true" size={16} weight="bold" />
          Open the lab
        </button>
      </div>
    </div>
    <ol aria-label="How to use this page" className="flex flex-col gap-2.5">
      <HeroStep
        number={1}
        title="Make something fail"
        description="Every button in Ledger fails on purpose, and each failure becomes one report."
      />
      <HeroStep
        number={2}
        title="See where it went"
        description="The latest report lists all five destinations, what each one answered, and why."
      />
      <HeroStep
        number={3}
        title="Break a destination"
        description="Slow your API down or take it offline in the lab. Only its answer changes."
      />
    </ol>
  </section>
);
