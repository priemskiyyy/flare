import type React from "react";
import type { ReactNode } from "react";

import { badgeStyles } from "examples/shared/ui/styles/badgeStyles";
import type { Tone } from "examples/shared/ui/types/Tone";

type BadgeProps = { tone: Tone; children: ReactNode };

export const Badge: React.FunctionComponent<BadgeProps> = ({
  tone,
  children,
}) => <span className={badgeStyles({ tone })}>{children}</span>;
