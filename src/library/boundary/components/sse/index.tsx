import * as React from "react";
import { G } from "@mobily/ts-belt";
import { useBroadcast } from "../broadcast/index.tsx";
import { emitAsync } from "../../../actions/utils.ts";
import { getActionSymbol, schemaOf } from "../../../action/utils.ts";
import type {
  SseConfig,
  SseConnected,
  SseEnvelope,
  SseHandle,
} from "./types.ts";
import { address, lookup, parse, reconcile } from "./utils.ts";

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
  const client = React.useRef<null | string>(null);
  const desired = React.useRef<null | Set<string>>(null);
  desired.current ??= new Set(config?.tags ?? []);

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

    return {
      async publish(envelope: SseEnvelope, tags?: readonly string[]) {
        const body: Record<string, unknown> = { data: envelope };
        if (G.isNotNullable(tags) && tags.length > 0) body.tags = tags;
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
        async add(tag: string) {
          desired.current?.add(tag);
          await mutate("PUT", tag);
        },
        async remove(tag: string) {
          desired.current?.delete(tag);
          await mutate("DELETE", tag);
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
        ...add.map((tag) => handle.tag.add(tag)),
        ...remove.map((tag) => handle.tag.remove(tag)),
      ]);
    });

    source.addEventListener("message", (event: MessageEvent<string>) => {
      const envelope = parse<SseEnvelope>(event.data);
      if (G.isNull(envelope)) return;
      const action = lookup(config.actions, envelope.name);
      if (G.isNull(action)) return;
      const schema = schemaOf(action);
      try {
        const payload = G.isNull(schema)
          ? envelope.payload
          : schema.parse(envelope.payload);
        void emitAsync(broadcast, getActionSymbol(action), payload, undefined);
      } catch (error) {
        // eslint-disable-next-line no-console
        console.warn(
          `march-hare: rejected omnicast "${envelope.name}" — the payload failed schema validation.`,
          error,
        );
      }
    });

    return () => {
      source.close();
      client.current = null;
    };
  }, [config, handle, broadcast]);

  return <SseContext.Provider value={handle}>{children}</SseContext.Provider>;
}
