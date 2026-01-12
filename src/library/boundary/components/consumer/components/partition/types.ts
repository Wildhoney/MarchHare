import { ConsumerRenderer } from "../../types.ts";

/**
 * Props for the Partition component.
 * @internal
 */
export type Props<T> = {
  action: symbol;
  renderer: ConsumerRenderer<T>;
};
