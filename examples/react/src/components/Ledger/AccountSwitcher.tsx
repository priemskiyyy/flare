import type React from "react";

import { PILL_CLASS_NAME } from "src/styles/pillStyles";
import { segmentStyles } from "src/styles/segmentStyles";
import type { AccountId } from "src/types/AccountId";
import { ACCOUNT_IDS, ACCOUNTS } from "src/utils/constants/accounts";

type AccountSwitcherProps = {
  account: AccountId | null;
  onAccountSelect: (account: AccountId | null) => void;
};

export const AccountSwitcher: React.FunctionComponent<AccountSwitcherProps> = ({
  account,
  onAccountSelect,
}) => (
  <div role="group" aria-label="Signed in as" className={PILL_CLASS_NAME}>
    {ACCOUNT_IDS.map((id) => (
      <button
        key={id}
        type="button"
        aria-pressed={id === account}
        onClick={() => onAccountSelect(id)}
        className={segmentStyles({ selected: id === account })}
      >
        <span
          aria-hidden="true"
          className="flex size-5 items-center justify-center rounded-full bg-stone-800 text-[10px] font-semibold text-white dark:bg-stone-200 dark:text-stone-900"
        >
          {ACCOUNTS[id].initials}
        </span>
        {ACCOUNTS[id].name}
      </button>
    ))}
    <button
      type="button"
      aria-pressed={account === null}
      onClick={() => onAccountSelect(null)}
      className={segmentStyles({ selected: account === null })}
    >
      Signed out
    </button>
  </div>
);
