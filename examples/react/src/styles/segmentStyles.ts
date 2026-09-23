import { cva } from "class-variance-authority";

export const segmentStyles = cva(
  "inline-flex h-8 items-center gap-1.5 rounded-full px-3.5 text-sm font-medium whitespace-nowrap transition-all duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500 disabled:cursor-not-allowed disabled:opacity-50",
  {
    variants: {
      selected: {
        true: "bg-white text-stone-900 shadow-sm ring-2 ring-amber-500/60 dark:bg-stone-950 dark:text-stone-100",
        false:
          "text-stone-600 hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-100",
      },
    },
  },
);
