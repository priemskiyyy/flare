import { cva } from "class-variance-authority";

export const iconTileStyles = cva(
  "inline-flex shrink-0 items-center justify-center bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300",
  {
    variants: {
      size: {
        regular: "size-9 rounded-xl",
        small: "size-8 rounded-lg",
      },
    },
    defaultVariants: { size: "regular" },
  },
);
