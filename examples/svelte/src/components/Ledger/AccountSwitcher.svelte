<script lang="ts">
  import {
    ACCOUNT_IDS,
    ACCOUNTS,
  } from "examples/shared/ledger/constants/accounts";
  import type { AccountId } from "examples/shared/ledger/types/AccountId";
  import { PILL_CLASS_NAME } from "examples/shared/ui/styles/pillStyles";
  import { segmentStyles } from "examples/shared/ui/styles/segmentStyles";

  type Props = {
    account: AccountId | null;
    onAccountSelect: (account: AccountId | null) => void;
  };

  let { account, onAccountSelect }: Props = $props();
</script>

<div role="group" aria-label="Signed in as" class={PILL_CLASS_NAME}>
  {#each ACCOUNT_IDS as id (id)}
    <button
      type="button"
      aria-pressed={id === account}
      onclick={() => onAccountSelect(id)}
      class={segmentStyles({ selected: id === account })}
    >
      <span
        aria-hidden="true"
        class="flex size-5 items-center justify-center rounded-full bg-stone-800 text-[10px] font-semibold text-white dark:bg-stone-200 dark:text-stone-900"
      >
        {ACCOUNTS[id].initials}
      </span>
      {ACCOUNTS[id].name}
    </button>
  {/each}
  <button
    type="button"
    aria-pressed={account === null}
    onclick={() => onAccountSelect(null)}
    class={segmentStyles({ selected: account === null })}
  >
    Signed out
  </button>
</div>
