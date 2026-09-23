import { cva } from "class-variance-authority";

import type { IconSize } from "examples/shared/ui/types/IconSize";

/** An icon drawn as a mask over the current text color, so it takes the tone around it. */
export const iconStyles = cva(
  "inline-block shrink-0 bg-current mask-contain mask-center mask-no-repeat",
  {
    variants: {
      size: {
        xsmall: "size-3",
        small: "size-3.5",
        regular: "size-4",
        large: "size-5",
      } satisfies Record<IconSize, string>,
    },
    defaultVariants: { size: "regular" },
  },
);
