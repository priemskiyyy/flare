<script setup lang="ts">
import { badgeStyles } from "examples/shared/ui/styles/badgeStyles";
import type { Tone } from "examples/shared/ui/types/Tone";

defineProps<{ tone: Tone }>();
</script>

<template>
  <span :class="badgeStyles({ tone })"><slot /></span>
</template>
