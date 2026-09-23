<script setup lang="ts">
import {
  ACCOUNT_IDS,
  ACCOUNTS,
} from "examples/shared/ledger/constants/accounts";
import type { AccountId } from "examples/shared/ledger/types/AccountId";
import { PILL_CLASS_NAME } from "examples/shared/ui/styles/pillStyles";
import { segmentStyles } from "examples/shared/ui/styles/segmentStyles";

defineProps<{ account: AccountId | null }>();

const emit = defineEmits<{ select: [account: AccountId | null] }>();
</script>

<template>
  <div role="group" aria-label="Signed in as" :class="PILL_CLASS_NAME">
    <button
      v-for="id in ACCOUNT_IDS"
      :key="id"
      type="button"
      :aria-pressed="id === account"
      :class="segmentStyles({ selected: id === account })"
      @click="emit('select', id)"
    >
      <span
        aria-hidden="true"
        class="flex size-5 items-center justify-center rounded-full bg-stone-800 text-[10px] font-semibold text-white dark:bg-stone-200 dark:text-stone-900"
      >
        {{ ACCOUNTS[id].initials }}
      </span>
      {{ ACCOUNTS[id].name }}
    </button>
    <button
      type="button"
      :aria-pressed="account === null"
      :class="segmentStyles({ selected: account === null })"
      @click="emit('select', null)"
    >
      Signed out
    </button>
  </div>
</template>
