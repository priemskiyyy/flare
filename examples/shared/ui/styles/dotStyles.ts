import { cva } from "class-variance-authority";

import type { Tone } from "examples/shared/ui/types/Tone";

export const dotStyles = cva("shrink-0 rounded-full", {
  variants: {
    tone: {
      neutral: "bg-stone-400",
      positive: "bg-emerald-500 shadow-[0_0_0_3px_rgb(16_185_129/0.2)]",
      warning: "animate-pulse bg-yellow-500",
      danger: "bg-rose-500 shadow-[0_0_0_3px_rgb(244_63_94/0.25)]",
      accent: "bg-amber-500",
      info: "animate-pulse bg-sky-500",
    } satisfies Record<Tone, string>,
    size: {
      small: "size-2",
      regular: "size-2.5",
    },
  },
  defaultVariants: { size: "small" },
});
