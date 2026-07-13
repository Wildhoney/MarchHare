import type { Actions } from "../../../types/index.ts";

/**
 * Configuration for the per-Boundary SSE connection, supplied via
 * `App({ sse })`. The server is expected to speak the Akela protocol:
 * `GET /sse?tags=a,b` for the event stream, `POST /send` for publishing,
 * and `PUT`/`DELETE` on `/clients/{client}/tags/{tag}` for tag mutation.
 */
export type SseConfig = {
  /** Base URL of the SSE server, e.g. `http://localhost:8080`. */
  url: string;
  /**
   * Omnicast actions permitted to arrive over the wire &mdash; a class or
   * nested namespace of actions declared with `Distribution.Omnicast`.
   * Incoming envelopes naming any other action are discarded and payloads
   * failing their action's schema are rejected, so this doubles as an
   * allow-list with runtime validation.
   */
  actions: Actions;
  /**
   * Tags the connection opens with. Mutations made through the connection
   * are remembered and re-applied whenever the connection is
   * re-established.
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
 * Payload of the server's `connected` event: the client identifier used
 * for sender exclusion and tag mutation, plus the tags the server
 * currently holds for the connection.
 */
export type SseConnected = {
  client: string;
  tags: string[];
};

/**
 * The per-Boundary SSE surface provided to `useActions` through React
 * context. `null` when the App was configured without an `sse` endpoint,
 * in which case omnicast dispatches degrade to plain broadcasts.
 */
export type SseHandle = {
  /**
   * Publishes an envelope to every other connected client, attributed
   * with this connection's client id so the server excludes the sender.
   * With `tags`, delivery narrows to clients holding all of them.
   */
  publish(envelope: SseEnvelope, tags?: readonly string[]): Promise<void>;
  /** The server-issued client id, or `null` before the first `connected`. */
  client(): null | string;
  /** Adds or removes a tag on this connection. */
  tag: {
    add(tag: string): Promise<void>;
    remove(tag: string): Promise<void>;
  };
};
