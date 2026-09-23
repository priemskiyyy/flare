import type { Component } from "solid-js";

import { iconStyles } from "examples/shared/ui/styles/iconStyles";
import type { IconSize } from "examples/shared/ui/types/IconSize";

type BaseIconProps = {
  src: string;
  size: IconSize;
  class?: string;
  classList?: Record<string, boolean>;
};

export const BaseIcon: Component<BaseIconProps> = (props) => (
  <span
    aria-hidden="true"
    class={iconStyles({ size: props.size, class: props.class })}
    classList={props.classList}
    style={{ "mask-image": `url("${props.src}")` }}
  />
);
