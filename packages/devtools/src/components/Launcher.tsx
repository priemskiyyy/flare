import type { FlareStatus } from "@priemskiyyy/flare";

import { FlareIcon } from "src/components/FlareIcon";
import { useAutoFocus } from "src/hooks/useAutoFocus";

type LauncherProps = {
  status: FlareStatus;
  hasUnseenError: boolean;
  autoFocus: boolean;
  onOpen: () => void;
};

export const Launcher = (props: LauncherProps) => {
  const focusOnMount = useAutoFocus(props.autoFocus);

  return (
    <button
      ref={focusOnMount}
      type="button"
      class="launcher"
      aria-label="Open Flare devtools"
      onClick={() => props.onOpen()}
    >
      <FlareIcon />
      <span>Flare</span>
      <span
        class="dot"
        data-state={props.hasUnseenError ? "error" : props.status.state}
      />
    </button>
  );
};
