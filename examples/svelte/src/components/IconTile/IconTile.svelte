<script lang="ts">
  import { iconTileStyles } from "examples/shared/ui/styles/iconTileStyles";
  import type { IconSize } from "examples/shared/ui/types/IconSize";
  import BaseIcon from "src/components/BaseIcon/BaseIcon.svelte";

  type TileSize = "regular" | "small";

  type Props = { icon: string; size: TileSize };

  const ICON_SIZES: Record<TileSize, IconSize> = {
    regular: "large",
    small: "regular",
  };

  let { icon, size }: Props = $props();
</script>

<span aria-hidden="true" class={iconTileStyles({ size })}>
  <BaseIcon src={icon} size={ICON_SIZES[size]} />
</span>
