import * as React from "react";

/**
 * Returns a function to force a component re-render.
 * Useful when state is managed externally (e.g., refs) but the UI needs updating.
 */
export function useRerender(): () => void {
  const [, rerender] = React.useReducer((x: number) => x + 1, 0);
  return rerender;
}
