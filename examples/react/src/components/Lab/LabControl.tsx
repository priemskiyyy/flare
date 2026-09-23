import type { Icon } from "@phosphor-icons/react";
import type React from "react";
import { useId } from "react";

import { buttonStyles } from "examples/shared/ui/styles/buttonStyles";

type LabControlProps = {
  icon: Icon;
  label: string;
  description: string;
  pressed: boolean;
  onPress: () => void;
};

export const LabControl: React.FunctionComponent<LabControlProps> = ({
  icon: ControlIcon,
  label,
  description,
  pressed,
  onPress,
}) => {
  const descriptionId = useId();

  return (
    <li className="flex flex-col gap-2 rounded-xl border border-stone-200 p-3 sm:odd:last:col-span-2 dark:border-stone-800">
      <button
        type="button"
        aria-pressed={pressed}
        aria-describedby={descriptionId}
        onClick={onPress}
        className={buttonStyles({ pressed })}
      >
        <ControlIcon aria-hidden="true" size={16} weight="bold" />
        {label}
      </button>
      <p
        id={descriptionId}
        className="text-sm leading-relaxed text-stone-600 dark:text-stone-400"
      >
        {description}
      </p>
    </li>
  );
};
