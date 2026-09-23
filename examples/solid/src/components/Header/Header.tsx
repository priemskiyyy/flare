import { useFlareStatus } from "@priemskiyyy/flare-solid";
import type { Component } from "solid-js";

import { FLARE_STATUS_LABELS } from "examples/shared/ledger/constants/labels";
import { ICONS } from "examples/shared/ui/constants/icons";
import { FLARE_STATUS_TONES } from "examples/shared/ui/constants/tones";
import { buttonStyles } from "examples/shared/ui/styles/buttonStyles";
import { dotStyles } from "examples/shared/ui/styles/dotStyles";
import { Badge } from "src/components/Badge/Badge";
import { BaseIcon } from "src/components/BaseIcon/BaseIcon";
import { IconTile } from "src/components/IconTile/IconTile";

// Nothing outlives the page, so reloading it is a complete reset.
const handleResetPress = () => {
  window.location.reload();
};

export const Header: Component = () => {
  const status = useFlareStatus();
  const tone = () => FLARE_STATUS_TONES[status().state];

  return (
    <header class="sticky top-0 z-20 border-b border-stone-200/70 bg-stone-50/80 backdrop-blur dark:border-stone-800 dark:bg-stone-950/70">
      <div class="mx-auto flex max-w-7xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 sm:px-6">
        <div class="mr-auto flex min-w-0 items-center gap-2">
          <IconTile src={ICONS.flame} size="small" />
          <h1 class="text-lg font-semibold">Ledger</h1>
          <Badge tone={tone()}>
            <span aria-hidden="true" class={dotStyles({ tone: tone() })} />
            {FLARE_STATUS_LABELS[status().state]}
          </Badge>
        </div>
        <button
          type="button"
          onClick={handleResetPress}
          class={buttonStyles({ variant: "ghost", size: "small" })}
        >
          <BaseIcon src={ICONS.arrowCounterClockwise} size="small" />
          Reset demo
        </button>
      </div>
    </header>
  );
};
