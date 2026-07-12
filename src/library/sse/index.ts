import * as React from "react";
import { G } from "@mobily/ts-belt";
import { useActions } from "../actions/index.ts";
import { getName } from "../action/index.ts";
import { isOmnicastAction, schemaOf } from "../omnicast/index.ts";
import type { Actions, AnyAction, Dispatch } from "../types/index.ts";
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

/**
 * Declares an SSE bridge at module scope, connecting a March Hare
 * application to an Akela-compatible server. Actions dispatched through the
 * handle fire locally through the normal dispatch pipeline **and** travel
 * over the wire to every other connected client, where the bridge
 * re-dispatches them into that client's Boundary. Subscribers simply
 * `useAction` the broadcast action as usual &mdash; local and remote
 * dispatches are indistinguishable.
 *
 * The sender never receives its own event back: the wire leg is attributed
 * with the connection's client id and the server excludes it, so the local
 * dispatch is the only delivery on the dispatching client.
 *
 * @example
 * ```ts
 * export class Wire {
 *   static Adopted = Broadcast.Cat.Adopted;
 *   static Opened = Broadcast.Cattery.Opened;
 * }
 *
 * export const sse = Sse({ url: "http://localhost:8080", actions: Wire });
 *
 * // Mount once inside the Boundary:
 * sse.useBridge();
 *
 * // Dispatch locally + remotely from any handler:
 * await sse.dispatch(Broadcast.Cat.Adopted, adoption);
 *
 * // Tag the connection; sends can then target tag subsets:
 * await sse.tag.add("vip");
 * await sse.tagged(["vip"]).dispatch(Broadcast.Cat.Adopted, adoption);
 * ```
 */
export function Sse<AC extends Actions>(config: SseConfig<AC>): SseHandle<AC> {
  const state = {
    client: <null | string>null,
    relay: <null | ((action: AnyAction, payload?: unknown) => Promise<void>)>(
      null
    ),
    tags: new Set<string>(config.tags ?? []),
    mounted: false,
  };

  /**
   * Widens the typed dispatch to a dynamic call path: incoming envelopes
   * resolve their action at runtime, so the compile-time union is not
   * expressible here. Every action passed through this path is a member of
   * `config.actions`, guaranteed by `lookup`.
   */
  function widen(
    dispatch: Dispatch<AC>,
  ): (action: AnyAction, payload?: unknown) => Promise<void> {
    return <(action: AnyAction, payload?: unknown) => Promise<void>>(
      (<unknown>dispatch)
    );
  }

  function relay(): (action: AnyAction, payload?: unknown) => Promise<void> {
    if (G.isNull(state.relay))
      throw new Error(
        "march-hare: the SSE bridge is not mounted — call sse.useBridge() inside a <Boundary>.",
      );
    return state.relay;
  }

  async function mutate(method: "PUT" | "DELETE", tag: string): Promise<void> {
    if (G.isNull(state.client)) return;
    const response = await fetch(
      `${config.url}/clients/${state.client}/tags/${encodeURIComponent(tag)}`,
      { method },
    );
    if (!response.ok)
      throw new Error(
        `march-hare: SSE tag mutation failed with HTTP ${response.status}.`,
      );
  }

  async function transmit(
    action: AnyAction,
    payload: unknown,
    tags: undefined | readonly string[],
  ): Promise<void> {
    if (!isOmnicastAction(action))
      throw new Error(
        "march-hare: only omnicast actions may travel over SSE — declare the action with Omnicast(name, schema).",
      );
    const schema = schemaOf(action);
    const parsed = G.isNull(schema) ? payload : schema.parse(payload);
    const local = relay()(action, parsed);
    const envelope: SseEnvelope = { name: getName(action), payload: parsed };
    const body: Record<string, unknown> = { data: envelope };
    if (G.isNotNullable(tags) && tags.length > 0) body.tags = tags;
    if (G.isNotNullable(state.client)) body.client = state.client;
    const remote = fetch(`${config.url}/send`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }).then((response) => {
      if (!response.ok)
        throw new Error(
          `march-hare: SSE publish failed with HTTP ${response.status}.`,
        );
    });
    await Promise.all([local, remote]);
  }

  function dispatcher(tags: undefined | readonly string[]): Dispatch<AC> {
    const send = (action: AnyAction, payload?: unknown) =>
      transmit(action, payload, tags);
    return <Dispatch<AC>>send;
  }

  function useBridge(): void {
    const actions = useActions<void, AC>();
    const relayRef = React.useRef(widen(actions.dispatch));
    relayRef.current = widen(actions.dispatch);

    React.useEffect(() => {
      if (state.mounted)
        throw new Error(
          "march-hare: sse.useBridge() is already mounted for this handle — mount it once per application.",
        );
      const source = new EventSource(address(config.url, state.tags));
      state.mounted = true;
      state.relay = (action, payload) => relayRef.current(action, payload);

      source.addEventListener("connected", (event: MessageEvent<string>) => {
        const connected = parse<SseConnected>(event.data);
        if (G.isNull(connected)) return;
        state.client = connected.client;
        const { add, remove } = reconcile(state.tags, connected.tags);
        void Promise.all([
          ...add.map((tag) => mutate("PUT", tag)),
          ...remove.map((tag) => mutate("DELETE", tag)),
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
          void relayRef.current(action, payload);
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
        state.mounted = false;
        state.relay = null;
        state.client = null;
      };
    }, []);
  }

  return {
    useBridge,
    dispatch: dispatcher(undefined),
    tagged: (tags) => ({ dispatch: dispatcher(tags) }),
    tag: {
      async add(tag) {
        state.tags.add(tag);
        await mutate("PUT", tag);
      },
      async remove(tag) {
        state.tags.delete(tag);
        await mutate("DELETE", tag);
      },
    },
    client: () => state.client,
  };
}
