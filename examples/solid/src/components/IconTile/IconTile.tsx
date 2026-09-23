import type { Component } from "solid-js";

import { iconTileStyles } from "examples/shared/ui/styles/iconTileStyles";
import type { IconSize } from "examples/shared/ui/types/IconSize";
import { BaseIcon } from "src/components/BaseIcon/BaseIcon";

type IconTileProps = { src: string; size: "regular" | "small" };

const ICON_SIZES: Record<IconTileProps["size"], IconSize> = {
  regular: "large",
  small: "regular",
};

export const IconTile: Component<IconTileProps> = (props) => (
  <span aria-hidden="true" class={iconTileStyles({ size: props.size })}>
    <BaseIcon src={props.src} size={ICON_SIZES[props.size]} />
  </span>
);
