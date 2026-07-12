import type { Actions, Dispatch } from "../types/index.ts";

/**
 * Configuration for an SSE bridge created with `Sse(config)`. The server is
 * expected to speak the Akela protocol: `GET /sse?tags=a,b` for the event
 * stream, `POST /send` for publishing, and `PUT`/`DELETE` on
 * `/clients/{client}/tags/{tag}` for tag mutation.
 */
export type SseConfig<AC extends Actions> = {
  /** Base URL of the SSE server, e.g. `http://localhost:8080`. */
  url: string;
  /**
   * Class of omnicast actions (created with `Omnicast(name, schema?)`)
   * permitted to travel over the wire. Incoming envelopes naming any other
   * action are discarded and payloads failing their action's schema are
   * rejected, so the class doubles as an allow-list with runtime
   * validation.
   */
  actions: AC;
  /**
   * Tags the connection opens with. Mutations made through `sse.tag` are
   * remembered and re-applied whenever the connection is re-established.
   */
  tags?: readonly string[];
};

/**
 * JSON envelope carried in the SSE `data` field and in the `data` property
 * of `POST /send`. The `name` mirrors the March Hare action name and is the
 * discriminator used to re-dispatch on the receiving side.
 */
export type SseEnvelope = {
  name: string;
  payload?: unknown;
};

/**
 * Payload of the server's `connected` event: the client identifier used for
 * sender exclusion and tag mutation, plus the tags the server currently
 * holds for the connection.
 */
export type SseConnected = {
  client: string;
  tags: string[];
};

/**
 * Handle returned by `Sse(config)`. Mount `useBridge()` once inside a
 * `<Boundary>`; from then on `dispatch(action, payload)` performs the local
 * broadcast and publishes the same envelope to every other connected
 * client, with the sender excluded server-side.
 */
export type SseHandle<AC extends Actions> = {
  /**
   * React hook that opens the connection and keeps it for the component's
   * lifetime. Mount it exactly once per application; a second concurrent
   * mount throws.
   */
  useBridge(): void;
  /**
   * Dispatches the action locally (same semantics as `actions.dispatch`)
   * and publishes it publicly over the wire. Resolves when the local
   * handlers have completed and the server has accepted the publish.
   */
  dispatch: Dispatch<AC>;
  /**
   * As `dispatch`, but the wire leg is delivered only to clients holding
   * **all** of the given tags. The local dispatch is unaffected.
   */
  tagged(tags: readonly string[]): { dispatch: Dispatch<AC> };
  /** Adds or removes a tag on this connection. */
  tag: {
    add(tag: string): Promise<void>;
    remove(tag: string): Promise<void>;
  };
  /** The server-issued client id, or `null` before the first `connected`. */
  client(): null | string;
};
