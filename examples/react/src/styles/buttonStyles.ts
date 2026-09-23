import { cva } from "class-variance-authority";

export const buttonStyles = cva(
  "inline-flex items-center justify-center gap-1.5 rounded-lg font-medium whitespace-nowrap transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500 disabled:cursor-not-allowed disabled:opacity-50",
  {
    variants: {
      variant: {
        primary:
          "bg-stone-900 text-white shadow-sm hover:bg-stone-700 dark:bg-amber-400 dark:text-stone-950 dark:hover:bg-amber-300",
        secondary:
          "border border-stone-300 bg-white shadow-sm hover:bg-stone-100 dark:border-stone-700 dark:bg-stone-900 dark:hover:bg-stone-800",
        ghost:
          "text-stone-600 hover:bg-stone-200/70 hover:text-stone-900 dark:text-stone-400 dark:hover:bg-stone-800 dark:hover:text-stone-100",
      },
      pressed: {
        true: "border-amber-500 text-amber-800 ring-2 ring-amber-500/60 dark:border-amber-400 dark:text-amber-200",
        false: "",
      },
      size: {
        regular: "h-10 px-4 text-sm",
        small: "h-8 px-2.5 text-sm",
      },
    },
    defaultVariants: { variant: "secondary", pressed: false, size: "regular" },
  },
);
