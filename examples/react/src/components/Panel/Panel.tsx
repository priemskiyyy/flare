import type { Icon } from "@phosphor-icons/react";
import clsx from "clsx";
import type React from "react";
import type { ReactNode } from "react";

import { IconTile } from "src/components/IconTile/IconTile";
import { CARD_CLASS_NAME } from "src/styles/cardStyles";

type PanelProps = {
  title: string;
  icon: Icon;
  shows: string;
  aside: ReactNode;
  children: ReactNode;
};

export const Panel: React.FunctionComponent<PanelProps> = ({
  title,
  icon,
  shows,
  aside,
  children,
}) => (
  <section
    aria-label={title}
    className={clsx("flex h-full min-w-0 flex-col gap-4 p-5", CARD_CLASS_NAME)}
  >
    <header className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-center gap-2">
        <IconTile icon={icon} size="small" />
        <h3 className="text-base font-semibold tracking-tight text-stone-800 dark:text-stone-200">
          {title}
        </h3>
        <div className="ml-auto flex flex-wrap items-center gap-2">{aside}</div>
      </div>
      <p className="text-sm text-stone-500 dark:text-stone-400">{shows}</p>
    </header>
    {children}
  </section>
);
