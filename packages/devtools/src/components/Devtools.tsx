import {
  createEffect,
  createMemo,
  createSignal,
  onCleanup,
  untrack,
} from "solid-js";
import type { Accessor } from "solid-js";

import { Launcher } from "src/components/Launcher";
import { DevtoolsPanel } from "src/components/Panel/DevtoolsPanel";
import { useObservableValue } from "src/hooks/useObservableValue";
import { useStoredValue } from "src/hooks/useStoredValue";
import { styles } from "src/styles";
import type { ObservedFlare } from "src/types/ObservedFlare";
import type { PanelPosition } from "src/types/PanelPosition";
import { assertUnreachable } from "src/utils/assertUnreachable";
import { devtoolsReducer, initialDevtoolsState } from "src/utils/devtoolsState";
import type { DevtoolsAction } from "src/utils/devtoolsState";
import type { EventLog } from "src/utils/EventLog";
import { parsePreferences } from "src/utils/parsePreferences";

const DEFAULT_SIZE = { bottom: 420, right: 520 } satisfies Record<
  PanelPosition,
  number
>;

const PREFERENCES_KEY = "@priemskiyyy/flare-devtools";

type DevtoolsProps = {
  flare: Accessor<ObservedFlare>;
  maxEvents: Accessor<number>;
  initialIsOpen: boolean;
  log: EventLog;
};

/** The shadow-root application: records while mounted and renders the launcher or the panel. */
export const Devtools = (props: DevtoolsProps) => {
  const [preferences, setPreferences] = useStoredValue(
    PREFERENCES_KEY,
    parsePreferences,
    {},
  );

  const [state, setState] = createSignal(
    initialDevtoolsState(preferences().isOpen ?? props.initialIsOpen),
  );

  const snapshot = useObservableValue(() => props.flare().diagnostics);
  const events = useObservableValue(() => props.log);
  const panel = createMemo(() => state().panel);
  const isPaused = createMemo(() => state().isPaused);
  const position = createMemo(() => preferences().position ?? "bottom");

  const size = createMemo(() => {
    const { height, width } = preferences();
    const current = position();

    if (current === "bottom") {
      return height ?? DEFAULT_SIZE.bottom;
    }

    if (current === "right") {
      return width ?? DEFAULT_SIZE.right;
    }

    return assertUnreachable(current);
  });

  const hasUnseenError = createMemo(() => {
    const current = panel();

    if (current.status !== "CLOSED") {
      return false;
    }

    return events().some(
      (event) => event.kind === "ERROR" && event.timestamp > current.closedAt,
    );
  });

  const dispatch = (action: DevtoolsAction) => {
    setState((current) => devtoolsReducer(current, action));
  };

  const handleSizeChange = (next: number) => {
    const current = position();

    if (current === "bottom") {
      setPreferences({ ...preferences(), height: next });

      return;
    }

    if (current === "right") {
      setPreferences({ ...preferences(), width: next });

      return;
    }

    assertUnreachable(current);
  };

  const handleDock = () => {
    const current = position();

    if (current === "bottom") {
      setPreferences({ ...preferences(), position: "right" });

      return;
    }

    if (current === "right") {
      setPreferences({ ...preferences(), position: "bottom" });

      return;
    }

    assertUnreachable(current);
  };

  createEffect(() => {
    props.log.setLimit(props.maxEvents());
  });

  createEffect(() => {
    if (isPaused()) {
      return;
    }

    const { diagnostics } = props.flare();

    onCleanup(diagnostics.events.subscribe(props.log.add));
  });

  // Only the panel state is tracked here; reading the preferences would re-run this on its own write.
  createEffect(() => {
    const isOpen = panel().status === "OPEN";

    setPreferences({ ...untrack(preferences), isOpen });
  });

  return (
    <div class="root" data-flare-devtools="">
      <style>{styles}</style>
      {(() => {
        const current = panel();

        if (current.status === "OPEN") {
          return (
            <DevtoolsPanel
              snapshot={snapshot()}
              events={events()}
              isPaused={isPaused()}
              autoFocus={current.autoFocus}
              position={position()}
              size={size()}
              onSizeChange={handleSizeChange}
              onDock={handleDock}
              onTogglePause={() => dispatch({ type: "TOGGLE_PAUSE" })}
              onClear={props.log.clear}
              onClose={() => dispatch({ type: "CLOSE", at: Date.now() })}
            />
          );
        }

        if (current.status === "CLOSED") {
          return (
            <Launcher
              status={snapshot().status}
              hasUnseenError={hasUnseenError()}
              autoFocus={current.autoFocus}
              onOpen={() => dispatch({ type: "OPEN" })}
            />
          );
        }

        return assertUnreachable(current);
      })()}
    </div>
  );
};
