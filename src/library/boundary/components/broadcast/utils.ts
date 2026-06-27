import EventEmitter from "eventemitter3";
import * as React from "react";
import type { Filter } from "../../../types/index.ts";

/**
 * Sentinel key used to store the cache entry for dispatches that
 * carried no channel (uncalled actions). Real channels are hashed via
 * `JSON.stringify`, which can never produce the empty string &mdash;
 * the two namespaces are safely disjoint.
 */
const DEFAULT_CHANNEL_KEY = "";

/**
 * Cache entry stored per `(event, channelHash)`. The original channel
 * object is preserved so mount replay can re-emit with the exact
 * channel the producer used &mdash; otherwise late-mounting subscribers
 * could not satisfy filtered-channel matching.
 */
type Entry = {
  readonly channel: Filter | undefined;
  readonly value: unknown;
};

function channelKey(channel: Filter | undefined): string {
  if (channel === undefined) return DEFAULT_CHANNEL_KEY;
  return JSON.stringify(channel);
}

/**
 * EventEmitter subclass that caches the latest payload per `(event,
 * channel)` pair. When a broadcast or multicast action is dispatched,
 * the payload is stored so that late-mounting components can replay it
 * via {@link useLifecycles} and handlers can read it via
 * `context.actions.final()`. Cache entries are keyed by both the
 * action and the channel object &mdash; multi-channel actions retain
 * one entry per channel rather than overwriting on every dispatch.
 */
export class BroadcastEmitter extends EventEmitter {
  private cache = new Map<string | symbol, Map<string, Entry>>();
  private latest = new Map<string | symbol, Entry>();

  override emit(event: string | symbol, ...args: unknown[]): boolean {
    this.setCache(event, args[0], undefined);
    return super.emit(event, ...args);
  }

  /**
   * Cache a value for a given event/channel pair without emitting to
   * listeners. Used by {@link emitAsync} to preserve caching when
   * bypassing `emit()`.
   */
  setCache(
    event: string | symbol,
    value: unknown,
    channel: Filter | undefined,
  ): void {
    const inner = this.cache.get(event) ?? new Map<string, Entry>();
    const entry: Entry = { channel, value };
    inner.set(channelKey(channel), entry);
    this.cache.set(event, inner);
    this.latest.set(event, entry);
  }

  /**
   * Retrieve the most recently cached payload across every channel for
   * a given event. Returns `undefined` if no value has ever been
   * dispatched. Use {@link getCachedAll} when channel-specific replay
   * is required &mdash; this overload exists for `context.actions
   * .final()`, which resolves to the most recent broadcast regardless
   * of channel.
   */
  getCached(event: string | symbol): unknown {
    return this.latest.get(event)?.value;
  }

  /**
   * Iterate every cached `(channel, value)` pair for a given event.
   * Mount replay walks this to re-emit per-channel values so that
   * late-mounting subscribers see the same broadcasts they would have
   * received had they been mounted at dispatch time.
   */
  getCachedAll(event: string | symbol): Iterable<Entry> {
    return this.cache.get(event)?.values() ?? [];
  }

  /**
   * Emit without caching the payload. Used by the framework to publish
   * fire-and-forget events (such as `Lifecycle.Fault`) where late-mounting
   * subscribers must not replay a stale value.
   */
  fire(event: string | symbol, ...args: unknown[]): boolean {
    return super.emit(event, ...args);
  }
}

/**
 * React context for broadcasting distributed actions across components.
 */
export const Context = React.createContext<BroadcastEmitter>(
  new BroadcastEmitter(),
);

/**
 * Hook to access the broadcast EventEmitter for emitting and listening to distributed actions.
 *
 * @returns The BroadcastEmitter instance for distributed actions.
 */
export function useBroadcast(): BroadcastEmitter {
  return React.useContext(Context);
}
