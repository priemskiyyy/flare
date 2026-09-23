import type React from "react";

import { useCurrentSection } from "src/hooks/useCurrentSection";
import { navLinkStyles } from "src/styles/navLinkStyles";
import { SECTION_IDS, SECTIONS } from "src/utils/constants/sections";
import { scrollToElement } from "src/utils/scrollToElement";

export const SectionNav: React.FunctionComponent = () => {
  const current = useCurrentSection();

  return (
    <nav
      aria-label="Explore Ledger"
      className="flex gap-1 overflow-x-auto py-1"
    >
      {SECTION_IDS.map((id) => (
        <button
          key={id}
          type="button"
          aria-current={current === id ? "location" : undefined}
          onClick={() => scrollToElement(id)}
          className={navLinkStyles({ current: current === id })}
        >
          {SECTIONS[id].label}
        </button>
      ))}
    </nav>
  );
};
