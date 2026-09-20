import { Show } from "solid-js";

import { formatEventLocal } from "src/formatting/formatEventLocal";
import type { ObservedDestination } from "src/types/ObservedDestination";

type DestinationDetailProps = {
  destination: ObservedDestination;
  onClose: () => void;
};

/**
 * What one destination declared it can honestly do. A failed destination's
 * error is deliberately not shown: it comes from a provider SDK and may quote
 * configuration. An unavailable one shows its reason, which the adapter wrote.
 */
export const DestinationDetail = (props: DestinationDetailProps) => {
  const capabilities = () => props.destination.capabilities;
  const reason = () => {
    const { status } = props.destination;
    return status.state === "unavailable" ? status.reason : null;
  };

  return (
    <section
      class="detail"
      aria-label={`${props.destination.name} destination`}
    >
      <div class="detail-header">
        <code class="detail-key">{props.destination.name}</code>
        <span class="status" data-state={props.destination.status.state}>
          <span class="dot" data-state={props.destination.status.state} />
          {props.destination.status.state}
        </span>
        <span class="muted">{props.destination.adapter}</span>
        <button
          type="button"
          class="icon-button detail-close"
          aria-label="Close detail"
          onClick={() => props.onClose()}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
            <path
              d="M3 3l8 8M11 3l-8 8"
              fill="none"
              stroke="currentColor"
              stroke-width="1.6"
              stroke-linecap="round"
            />
          </svg>
        </button>
      </div>
      <Show when={reason()}>
        {(text) => <p class="detail-reason">{text()}</p>}
      </Show>
      <dl class="capabilities">
        <dt>event-local</dt>
        <dd>{formatEventLocal(capabilities().eventLocal)}</dd>
        <dt>messages</dt>
        <dd>{capabilities().messages ? "yes" : "no"}</dd>
        <dt>evidence</dt>
        <dd>{capabilities().evidence}</dd>
        <dt>flush</dt>
        <dd>{capabilities().flush}</dd>
        <dt>queue</dt>
        <dd>{capabilities().queue}</dd>
        <dt>automatic capture</dt>
        <dd>{capabilities().automaticCapture}</dd>
        <dt>instance</dt>
        <dd>{capabilities().instance}</dd>
        <dt>filtering</dt>
        <dd>{capabilities().filtering}</dd>
      </dl>
    </section>
  );
};
