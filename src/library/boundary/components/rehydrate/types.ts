import type * as React from "react";

/**
 * Store for rehydrated model snapshots.
 * Keyed by serialised channel string, values are model snapshots.
 */
export type Rehydrator = {
  data: Map<string, unknown>;
};

/**
 * Props for the RehydrateProvider component.
 */
export type Props = {
  children: React.ReactNode;
};
