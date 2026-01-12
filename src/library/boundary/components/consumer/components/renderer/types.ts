import { ConsumerRenderer } from "../../types.ts";

/**
 * Props for the ConsumeRenderer component.
 * @internal
 */
export type Props<T> = {
  action: symbol;
  renderer: ConsumerRenderer<T>;
};
