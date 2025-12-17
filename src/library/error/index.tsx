import { Props } from "./types";
import { ErrorContext } from "./utils";

export { useError } from "./utils";
export { Reason, AbortError, TimeoutError } from "./types";
export type { ErrorDetails, ErrorHandler } from "./types";

/**
 * Error boundary component for catching and handling errors from actions.
 *
 * @template E Custom error types to include in the handler's error union.
 * @param props.handler - The error handler function to call when an error occurs.
 * @param props.children - The children to render within the error boundary.
 * @returns The children wrapped in an error context provider.
 *
 * @example
 * ```tsx
 * <Error<ApiError | ValidationError>
 *   handler={({ error }) => {
 *     if (error instanceof ApiError) handleApiError(error);
 *   }}
 * >
 *   <App />
 * </Error>
 * ```
 */
export function Error<E extends Error = never>({
  handler,
  children,
}: Props<E>) {
  return (
    <ErrorContext.Provider value={handler}>{children}</ErrorContext.Provider>
  );
}
