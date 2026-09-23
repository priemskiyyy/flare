import { useEffect, useState } from "react";

import type { SectionId } from "src/types/SectionId";
import { SECTION_IDS } from "src/utils/constants/sections";

const isSectionId = (id: string): id is SectionId =>
  SECTION_IDS.some((sectionId) => sectionId === id);

// At the bottom of the page the last section is current, even when it is
// too short to reach the band the observer watches.
const pickSection = (crossing: Set<SectionId>) => {
  const atBottom =
    window.innerHeight + window.scrollY >=
    document.documentElement.scrollHeight - 1;

  if (atBottom) {
    return SECTION_IDS.at(-1);
  }

  return SECTION_IDS.find((id) => crossing.has(id));
};

/** The section the reader is in, for the navigation to mark. */
export const useCurrentSection = () => {
  const [current, setCurrent] = useState<SectionId>("app");

  useEffect(() => {
    const crossing = new Set<SectionId>();

    const handleScroll = () => {
      const next = pickSection(crossing);

      if (next === undefined) {
        return;
      }

      setCurrent(next);
    };

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const { id } = entry.target;

          if (!isSectionId(id)) {
            continue;
          }

          if (entry.isIntersecting) {
            crossing.add(id);

            continue;
          }

          crossing.delete(id);
        }

        handleScroll();
      },
      { rootMargin: "-33% 0px -62% 0px" },
    );

    for (const id of SECTION_IDS) {
      const element = document.getElementById(id);

      if (element === null) {
        continue;
      }

      observer.observe(element);
    }

    window.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  return current;
};
