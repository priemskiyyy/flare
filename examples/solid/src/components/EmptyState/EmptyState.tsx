import type { Component } from "solid-js";

import { BaseIcon } from "src/components/BaseIcon/BaseIcon";

type EmptyStateProps = { icon: string; title: string; description: string };

export const EmptyState: Component<EmptyStateProps> = (props) => (
  <div class="flex flex-col items-center gap-1.5 rounded-lg border border-dashed border-stone-300 px-4 py-6 text-center dark:border-stone-700">
    <BaseIcon src={props.icon} size="large" class="text-stone-400" />
    <p class="text-base font-medium">{props.title}</p>
    <p class="max-w-sm text-sm text-stone-500 dark:text-stone-400">
      {props.description}
    </p>
  </div>
);
