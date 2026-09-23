<script setup lang="ts">
import { iconTileStyles } from "examples/shared/ui/styles/iconTileStyles";
import type { IconSize } from "examples/shared/ui/types/IconSize";
import BaseIcon from "src/components/BaseIcon/BaseIcon.vue";

type TileSize = "regular" | "small";

const ICON_SIZES: Record<TileSize, IconSize> = {
  regular: "large",
  small: "regular",
};

defineProps<{ src: string; size: TileSize }>();
</script>

<template>
  <span aria-hidden="true" :class="iconTileStyles({ size })">
    <BaseIcon :src="src" :size="ICON_SIZES[size]" />
  </span>
</template>
