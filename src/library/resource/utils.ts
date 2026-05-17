/**
 * Module-private sentinel marking "no successful run has happened yet"
 * on a resource handle's cache slot. Required so `.else(fallback)` can
 * distinguish that case from "the fetcher legitimately resolved with
 * `null`". Re-exported only via the `config` bag below; consumers
 * outside this module cannot construct or compare against this value.
 *
 * @internal
 */
const unset: unique symbol = Symbol("march-hare.resource.unset");

/**
 * Internal configuration constants for the resource module. Wraps the
 * `unset` sentinel so its `unique symbol` type stays nominal when
 * imported elsewhere via `typeof config.unset`.
 *
 * @internal
 */
export const config = <const>{
  unset,
};

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
