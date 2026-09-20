import { assertUnreachable } from "src/utils/assertUnreachable";

export type DevtoolsState = {
  panel:
    | { status: "OPEN"; autoFocus: boolean }
    | { status: "CLOSED"; autoFocus: boolean; closedAt: number };
  isPaused: boolean;
};

export type DevtoolsAction =
  { type: "OPEN" } | { type: "CLOSE"; at: number } | { type: "TOGGLE_PAUSE" };

/** Focus only moves after the user opens or closes the panel, never on mount. */
export const initialDevtoolsState = (
  initialIsOpen: boolean,
): DevtoolsState => ({
  panel: initialIsOpen
    ? { status: "OPEN", autoFocus: false }
    : { status: "CLOSED", autoFocus: false, closedAt: 0 },
  isPaused: false,
});

export const devtoolsReducer = (
  state: DevtoolsState,
  action: DevtoolsAction,
): DevtoolsState => {
  if (action.type === "OPEN") {
    return { ...state, panel: { status: "OPEN", autoFocus: true } };
  }

  if (action.type === "CLOSE") {
    return {
      ...state,
      panel: { status: "CLOSED", autoFocus: true, closedAt: action.at },
    };
  }

  if (action.type === "TOGGLE_PAUSE") {
    return { ...state, isPaused: !state.isPaused };
  }

  return assertUnreachable(action);
};
