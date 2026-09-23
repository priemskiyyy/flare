import type { Accessor } from "solid-js";

import type { PanelPosition } from "src/types/PanelPosition";
import { assertUnreachable } from "src/utils/assertUnreachable";

const MIN_SIZE = 240;
const EDGE_MARGIN = 24;
const KEYBOARD_STEP = 24;

/** Pointer dragging and arrow-key handlers that resize a panel docked to one edge. */
export const useResize = ({
  position,
  size,
  onSizeChange,
}: {
  position: Accessor<PanelPosition>;
  size: Accessor<number>;
  onSizeChange: (size: number) => void;
}) => {
  const availableSpace = () => {
    const current = position();

    if (current === "bottom") {
      return window.innerHeight;
    }

    if (current === "right") {
      return window.innerWidth;
    }

    return assertUnreachable(current);
  };

  const clamp = (value: number) =>
    Math.min(Math.max(value, MIN_SIZE), availableSpace() - EDGE_MARGIN);

  // Dragging the handle away from its edge grows the panel on either axis.
  const dragDistance = (start: PointerEvent, move: PointerEvent) => {
    const current = position();

    if (current === "bottom") {
      return start.clientY - move.clientY;
    }

    if (current === "right") {
      return start.clientX - move.clientX;
    }

    return assertUnreachable(current);
  };

  // The arrow that points away from the edge grows the panel.
  const arrowKeys = () => {
    const current = position();

    if (current === "bottom") {
      return { grow: "ArrowUp", shrink: "ArrowDown" };
    }

    if (current === "right") {
      return { grow: "ArrowLeft", shrink: "ArrowRight" };
    }

    return assertUnreachable(current);
  };

  const handlePointerDown = (
    event: PointerEvent & { currentTarget: HTMLElement },
  ) => {
    const handle = event.currentTarget;
    const startSize = size();

    const handlePointerMove = (move: PointerEvent) => {
      onSizeChange(clamp(startSize + dragDistance(event, move)));
    };

    const handlePointerUp = () => {
      handle.removeEventListener("pointermove", handlePointerMove);
      handle.removeEventListener("pointerup", handlePointerUp);
    };

    handle.setPointerCapture(event.pointerId);
    handle.addEventListener("pointermove", handlePointerMove);
    handle.addEventListener("pointerup", handlePointerUp);
  };

  const handleKeyDown = (event: KeyboardEvent) => {
    const { grow, shrink } = arrowKeys();

    if (event.key === grow) {
      event.preventDefault();
      onSizeChange(clamp(size() + KEYBOARD_STEP));

      return;
    }

    if (event.key === shrink) {
      event.preventDefault();
      onSizeChange(clamp(size() - KEYBOARD_STEP));
    }
  };

  return { handlePointerDown, handleKeyDown };
};
