import { For } from "solid-js";
import type { Component } from "solid-js";

import {
  ACCOUNT_IDS,
  ACCOUNTS,
} from "examples/shared/ledger/constants/accounts";
import type { AccountId } from "examples/shared/ledger/types/AccountId";
import { PILL_CLASS_NAME } from "examples/shared/ui/styles/pillStyles";
import { segmentStyles } from "examples/shared/ui/styles/segmentStyles";

type AccountSwitcherProps = {
  account: AccountId | null;
  onAccountSelect: (account: AccountId | null) => void;
};

export const AccountSwitcher: Component<AccountSwitcherProps> = (props) => (
  <div role="group" aria-label="Signed in as" class={PILL_CLASS_NAME}>
    <For each={ACCOUNT_IDS}>
      {(id) => (
        <button
          type="button"
          aria-pressed={id === props.account}
          onClick={() => props.onAccountSelect(id)}
          class={segmentStyles({ selected: id === props.account })}
        >
          <span
            aria-hidden="true"
            class="flex size-5 items-center justify-center rounded-full bg-stone-800 text-[10px] font-semibold text-white dark:bg-stone-200 dark:text-stone-900"
          >
            {ACCOUNTS[id].initials}
          </span>
          {ACCOUNTS[id].name}
        </button>
      )}
    </For>
    <button
      type="button"
      aria-pressed={props.account === null}
      onClick={() => props.onAccountSelect(null)}
      class={segmentStyles({ selected: props.account === null })}
    >
      Signed out
    </button>
  </div>
);
