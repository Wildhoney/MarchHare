import { Props } from "./types";
import { ErrorContext } from "./utils";

export { useError } from "./utils";
export { Reason } from "./types";
export type { ErrorDetails, ErrorHandler } from "./types";

/**
 * Error boundary component for catching and handling errors from actions.
 *
 * @param props.handler - The error handler function to call when an error occurs.
 * @param props.children - The children to render within the error boundary.
 * @returns The children wrapped in an error context provider.
 */
export function Error({ handler, children }: Props) {
  return (
    <ErrorContext.Provider value={handler}>{children}</ErrorContext.Provider>
  );
}
