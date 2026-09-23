import { cva } from "class-variance-authority";

export const navLinkStyles = cva(
  "shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium whitespace-nowrap transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500",
  {
    variants: {
      current: {
        true: "bg-stone-900 text-white dark:bg-amber-400 dark:text-stone-950",
        false:
          "text-stone-600 hover:bg-stone-200/70 hover:text-stone-900 dark:text-stone-400 dark:hover:bg-stone-800 dark:hover:text-stone-100",
      },
    },
  },
);
