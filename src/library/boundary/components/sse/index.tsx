import * as React from "react";
import { G } from "@mobily/ts-belt";
import { useBroadcast } from "../broadcast/index.tsx";
import { useTasks } from "../tasks/utils.ts";
import { useTap } from "../tap/utils.ts";
import { emitAsync } from "../../../actions/utils.ts";
import { getActionSymbol, getName, validate } from "../../../action/utils.ts";
import { getError, getReason } from "../../../error/utils.ts";
import { FaultSymbol } from "../../../types/index.ts";
import type {
  SseConfig,
  SseConnected,
  SseEnvelope,
  SseHandle,
} from "./types.ts";
import { address, eligible, lookup, parse, reconcile } from "./utils.ts";

export type {
  SseConfig,
  SseConnected,
  SseEnvelope,
  SseHandle,
} from "./types.ts";

export const SseContext = React.createContext<null | SseHandle>(null);

/**
 * Reads the enclosing Boundary's SSE handle; `null` when the App was
 * configured without an `sse` endpoint.
 *
 * @internal
 */
export function useSse(): null | SseHandle {
  return React.useContext(SseContext);
}

/**
 * Per-Boundary SSE connection, mounted automatically by `<Boundary>` when
 * the App is configured with an `sse` endpoint. Owns the connection
 * lifecycle end to end: it connects on mount, disconnects on unmount,
 * rides `EventSource`'s automatic reconnection (re-reading the client id
 * and re-applying tag mutations after every reconnect), and re-dispatches
 * validated incoming envelopes into the Boundary as ordinary broadcasts.
 *
 * The handle it provides through {@link SseContext} is what `dispatch`
 * uses to publish omnicast actions to the wire; without a config the
 * context stays `null` and omnicast dispatches degrade to plain
 * broadcasts.
 *
 * @internal
 */
export function Sse({
  config,
  children,
}: {
  config?: SseConfig;
  children: React.ReactNode;
}): React.ReactElement {
  const broadcast = useBroadcast();
  const tasks = useTasks();
  const tap = useTap();
  const client = React.useRef<null | string>(null);
  const desired = React.useRef<null | Set<string>>(null);
  desired.current ??= new Set(config?.tags ?? []);
  const align = React.useRef<
    null | ((method: "PUT" | "DELETE", tag: string) => Promise<void>)
  >(null);

  const handle = React.useMemo<null | SseHandle>(() => {
    if (G.isUndefined(config)) return null;
    const endpoint = config;

    async function mutate(
      method: "PUT" | "DELETE",
      tag: string,
    ): Promise<void> {
      if (G.isNull(client.current)) return;
      const response = await fetch(
        `${endpoint.url}/clients/${client.current}/tags/${encodeURIComponent(tag)}`,
        { method },
      );
      if (!response.ok)
        throw new Error(
          `march-hare: SSE tag mutation failed with HTTP ${response.status}.`,
        );
    }

    align.current = mutate;

    return {
      async publish(envelope: SseEnvelope) {
        const body: Record<string, unknown> = { data: envelope };
        if (G.isNotNullable(envelope.tags) && envelope.tags.length > 0)
          body.tags = envelope.tags;
        if (G.isNotNullable(client.current)) body.client = client.current;
        const response = await fetch(`${endpoint.url}/send`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!response.ok)
          throw new Error(
            `march-hare: SSE publish failed with HTTP ${response.status}.`,
          );
      },
      client: () => client.current,
      tag: {
        async add(...tags: readonly [string, ...string[]]) {
          const fresh = [...new Set(tags)].filter(
            (tag) => !(desired.current?.has(tag) ?? false),
          );
          fresh.forEach((tag) => desired.current?.add(tag));
          await Promise.all(fresh.map((tag) => mutate("PUT", tag)));
        },
        async remove(...tags: readonly [string, ...string[]]) {
          const held = [...new Set(tags)].filter(
            (tag) => desired.current?.has(tag) ?? false,
          );
          held.forEach((tag) => desired.current?.delete(tag));
          await Promise.all(held.map((tag) => mutate("DELETE", tag)));
        },
        has(...tags: readonly [string, ...string[]]) {
          return tags.every((tag) => desired.current?.has(tag) ?? false);
        },
        async clear() {
          const held = [...(desired.current ?? [])];
          desired.current?.clear();
          await Promise.all(held.map((tag) => mutate("DELETE", tag)));
        },
      },
    };
  }, [config]);

  React.useEffect(() => {
    if (G.isUndefined(config) || G.isNull(handle)) return;
    const tags = desired.current ?? new Set<string>();
    const source = new EventSource(address(config.url, tags));

    source.addEventListener("connected", (event: MessageEvent<string>) => {
      const connected = parse<SseConnected>(event.data);
      if (G.isNull(connected)) return;
      client.current = connected.client;
      const { add, remove } = reconcile(tags, connected.tags);
      void Promise.all([
        ...add.map((tag) => align.current?.("PUT", tag)),
        ...remove.map((tag) => align.current?.("DELETE", tag)),
      ]).catch((error) => {
        // eslint-disable-next-line no-console
        console.warn(
          "march-hare: failed to re-apply tags after an SSE reconnect.",
          error,
        );
      });
    });

    source.addEventListener("message", (event: MessageEvent<string>) => {
      const envelope = parse<SseEnvelope>(event.data);
      if (G.isNull(envelope)) return;
      const action = lookup(config.actions, envelope.name);
      if (G.isNull(action)) return;
      if (!eligible(envelope.tags, desired.current ?? new Set())) return;
      const deliver = (): Promise<void> => {
        try {
          const payload = validate(action, envelope.payload);
          return emitAsync(
            broadcast,
            getActionSymbol(action),
            payload,
            envelope.channel,
          );
        } catch (caught) {
          const identity = { name: getName(action), payload: envelope.payload };
          const task = {
            controller: new AbortController(),
            action: getActionSymbol(action),
            payload: envelope.payload,
          };
          const startedAt = performance.now();
          tap({ stage: "start", action: identity, details: { task } });
          tap({
            stage: "end",
            result: "error",
            action: identity,
            details: {
              task,
              elapsed: performance.now() - startedAt,
              mutations: { model: null, env: null },
              error: getError(caught),
              reason: getReason(caught),
            },
          });
          broadcast.fire(FaultSymbol, {
            reason: getReason(caught),
            error: getError(caught),
            action: envelope.name,
            handled: false,
            tasks,
            retry: deliver,
          });
          return Promise.resolve();
        }
      };
      void deliver();
    });

    return () => {
      source.close();
      client.current = null;
    };
  }, [config, handle, broadcast, tasks, tap]);

  return <SseContext.Provider value={handle}>{children}</SseContext.Provider>;
}
