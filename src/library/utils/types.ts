import { unset } from "./utils.ts";

/** Nominal type of the {@link unset} sentinel. */
export type Unset = typeof unset;

/**
 * On-disk JSON shape of a {@link Stored} envelope. The Store wrapper
 * encodes a populated Stored as `{ data, at: at.toString() }` so the
 * `Temporal.Instant` survives the string round-trip, and decodes via
 * `Temporal.Instant.from(...)` on read. Adapters never see this shape
 * directly — they shuttle the already-stringified JSON.
 *
 * @template T The payload type carried by the matching {@link Stored}.
 */
export type Encoded<T> = {
  readonly data: T;
  readonly at: string;
};

/**
 * Common shape for a possibly-present value with a timestamp. Produced by
 * `BoundResourceHandle.snapshot()` (from the in-memory cache) and by
 * `Store.get(key)` (from persistent storage). Both feed into the bound
 * handle's overloaded `.else(...)`, which seeds the cache when given a
 * Stored that carries data and a timestamp.
 *
 * @template T The payload type when present.
 */
export type Stored<T> = {
  /** The payload, or {@link unset} when nothing is recorded. */
  readonly data: T | Unset;
  /** When the payload was recorded, or `null` when nothing is recorded. */
  readonly at: Temporal.Instant | null;
  /**
   * Returns {@link data} when present, otherwise the supplied fallback.
   * Symmetric with `BoundResourceHandle.else(...)`'s terminal form.
   */
  readonly else: <U>(fallback: U) => T | U;
};

/**
 * Adapter contract for synchronous key/value storage. Implement once per
 * backend (localStorage, MMKV on React Native, chrome.storage with a sync
 * facade, etc.) and pass to `store`. The adapter shuttles raw strings;
 * JSON encoding and `Temporal.Instant` round-tripping happen inside the
 * Store wrapper, so adapters stay trivial.
 */
export type Adapter = {
  /**
   * Return the raw string stored under `key`, or `null` when no entry
   * exists. The Store wrapper handles JSON parsing and `Temporal.Instant`
   * round-tripping, so this stays a plain string getter. Treat any
   * read-time error (decryption, IPC, etc.) as "not found" and return
   * `null` — the Store falls through to its next fallback rather than
   * crashing the render.
   */
  readonly get: (key: string) => string | null;
  /**
   * Persist the raw string `value` under `key`. The Store guarantees
   * `value` is a JSON-encoded `{ data, at }` envelope produced by a
   * resolved snapshot — never a placeholder. Throwing is fine on quota,
   * private mode, sandboxed iframes, etc.; the Store catches and
   * swallows so a write failure can't poison an already-resolved fetch.
   */
  readonly set: (key: string, value: string) => void;
  /**
   * Drop the entry at `key`. Idempotent — calling `remove` for a key
   * that isn't present must not throw.
   */
  readonly remove: (key: string) => void;
  /**
   * Wipe every entry this adapter can see. On a shared backend such as
   * `localStorage` this means the whole origin — third-party SDK state,
   * dismissed banners, route hints, etc. all go with it. Adapter authors
   * should either delegate to the backend's native clear (accepting that
   * scope) or namespace by key prefix and remove only their own.
   */
  readonly clear: () => void;
};

/**
 * Bound storage instance returned by `store`. Reads return a
 * {@link Stored} handle so the result composes with the Resource bound
 * handle's `.else(...)`; writes accept a Stored and short-circuit on the
 * empty case to avoid persisting placeholder snapshots.
 */
export type Store = Pick<Adapter, "remove" | "clear"> & {
  /**
   * Read the entry at `key` as a {@link Stored} envelope. Returns an
   * empty Stored (`data: unset`, `at: null`) when nothing is recorded
   * or when the persisted payload fails to parse — corrupted entries
   * never reach the caller. The result composes directly with a
   * Resource bound handle's `.else(...)` for seeding the cache after
   * a reload.
   */
  readonly get: <T>(key: string) => Stored<T>;
  /**
   * Persist `value` under `key`. Returns `true` when the entry landed
   * in the adapter, `false` otherwise. A `false` covers two distinct
   * cases: the Stored had no payload yet (`data === unset` or
   * `at === null`), or the adapter threw (quota, private mode, etc.).
   * Callers that care about quota failures should branch on the
   * return; callers writing on every dispatch can safely ignore it.
   */
  readonly set: <T>(key: string, value: Stored<T>) => boolean;
};
