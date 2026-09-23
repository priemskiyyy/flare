import type { Icon } from "@phosphor-icons/react";
import type React from "react";

import { iconTileStyles } from "examples/shared/ui/styles/iconTileStyles";

type IconTileProps = { icon: Icon; size: "regular" | "small" };

const ICON_SIZES: Record<IconTileProps["size"], number> = {
  regular: 20,
  small: 16,
};

export const IconTile: React.FunctionComponent<IconTileProps> = ({
  icon: TileIcon,
  size,
}) => (
  <span aria-hidden="true" className={iconTileStyles({ size })}>
    <TileIcon size={ICON_SIZES[size]} weight="duotone" />
  </span>
);
