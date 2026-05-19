import { unset } from "../utils/index.ts";

/**
 * Module-level cache shared by every `Resource` declaration. Keyed by
 * the fetcher function itself so each module-scope declaration gets a
 * distinct slot &mdash; entries are garbage-collected when the fetcher
 * reference is dropped.
 *
 * @internal
 */
export const cache = new WeakMap<
  object,
  {
    data: unknown;
    at: Temporal.Instant;
  }
>();

/**
 * Re-export of the shared `unset` sentinel from {@link "../utils/index.ts"}.
 * Kept under `config` for back-compatibility with existing imports in this
 * module's siblings; new code should import `unset` directly from `utils`.
 *
 * @internal
 */
export const config = <const>{
  unset,
};
