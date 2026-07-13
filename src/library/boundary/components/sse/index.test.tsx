import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { act, render, waitFor } from "@testing-library/react";
import { z } from "zod";
import { useActions } from "../../../actions/index.ts";
import { Action } from "../../../action/index.ts";
import { Boundary } from "../../index.tsx";
import {
  Audience,
  Distribution,
  Lifecycle,
  type UseActions,
} from "../../../types/index.ts";
import { Reason } from "../../../error/index.ts";
import type { Fault } from "../../../error/types.ts";

const member = z.object({ member: z.string() });

class Omnicast {
  static Room = class {
    static Joined = Action("Room.Joined", Distribution.Omnicast(member));
    static Renamed = Action(
      "Room.Renamed",
      Distribution.Omnicast<{ member: string }, { Id: number }>(member),
    );
  };
}

class Actions {
  static JoinRoom = Action<{ id: number }>("JoinRoom");
  static Omnicast = Omnicast;
}

class FakeEventSource {
  static instances: FakeEventSource[] = [];
  listeners = new Map<string, Set<(event: MessageEvent<string>) => void>>();
  closed = false;

  constructor(public url: string) {
    FakeEventSource.instances.push(this);
  }

  addEventListener(
    type: string,
    listener: (event: MessageEvent<string>) => void,
  ): void {
    const bucket = this.listeners.get(type) ?? new Set();
    bucket.add(listener);
    this.listeners.set(type, bucket);
  }

  close(): void {
    this.closed = true;
  }

  emit(type: string, value: unknown): void {
    const event = new MessageEvent<string>(type, {
      data: JSON.stringify(value),
    });
    for (const listener of this.listeners.get(type) ?? []) listener(event);
  }
}

let handle: null | UseActions<void, typeof Actions> = null;
let received = vi.fn();
let renamed = vi.fn();
let faulted = vi.fn();
let holding = vi.fn();
const original = globalThis.EventSource;

function Harness(): null {
  const actions = useActions<void, typeof Actions>();
  handle = actions;

  actions.useAction(Actions.Omnicast.Room.Joined, (_context, joined) => {
    received(joined.member);
  });

  actions.useAction(
    Actions.Omnicast.Room.Renamed({ Id: 1 }),
    (_context, changed) => {
      renamed(changed.member);
    },
  );

  actions.useAction(Lifecycle.Fault, (_context, fault) => {
    faulted(fault);
  });

  actions.useAction(Actions.JoinRoom, async (context, room) => {
    await context.actions.tag.add(`room-${room.id}`);

    await context.actions.dispatch(
      Actions.Omnicast.Room.Joined,
      Audience.Private([`room-${room.id}`]),
      { member: "Adam" },
    );

    holding(
      context.actions.tag.has(`room-${room.id}`),
      context.actions.tag.has(`room-${room.id}`, "absent"),
    );
  });

  return null;
}

function renderHarness(config?: {
  tags?: readonly string[];
  omit?: boolean;
}): FakeEventSource | undefined {
  render(
    config?.omit === true ? (
      <Boundary>
        <Harness />
      </Boundary>
    ) : (
      <Boundary
        sse={{ url: "http://sse.test", actions: Omnicast, tags: config?.tags }}
      >
        <Harness />
      </Boundary>
    ),
  );
  return FakeEventSource.instances.at(-1);
}

function connect(source: FakeEventSource, tags: string[] = []): void {
  act(() => {
    source.emit("connected", { client: "client-1", tags });
  });
}

function sends(): Array<{ url: string; method: string; body: unknown }> {
  const mocked = globalThis.fetch as unknown as ReturnType<typeof vi.fn>;
  return mocked.mock.calls.map((call) => {
    const url = call[0] as string;
    const init = call[1] as RequestInit | undefined;
    return {
      url,
      method: init?.method ?? "GET",
      body: typeof init?.body === "string" ? JSON.parse(init.body) : undefined,
    };
  });
}

describe("omnicast over SSE", () => {
  beforeEach(() => {
    FakeEventSource.instances = [];
    handle = null;
    received = vi.fn();
    renamed = vi.fn();
    faulted = vi.fn();
    holding = vi.fn();
    globalThis.EventSource =
      FakeEventSource as unknown as typeof globalThis.EventSource;
    vi.spyOn(globalThis, "fetch").mockImplementation(
      async () => new Response(null, { status: 202 }),
    );
  });

  afterEach(() => {
    globalThis.EventSource = original;
    vi.restoreAllMocks();
  });

  it("registers the tag before the audience dispatch when awaited in sequence", async () => {
    const source = renderHarness();
    if (!source) throw new Error("no connection opened");
    connect(source);

    await act(async () => {
      await handle?.dispatch(Actions.JoinRoom, { id: 7 });
    });

    const calls = sends();
    expect(calls[0].method).toBe("PUT");
    expect(calls[0].url).toBe("http://sse.test/clients/client-1/tags/room-7");
    expect(calls[1].method).toBe("POST");
    expect(calls[1].url).toBe("http://sse.test/send");
    expect(calls[1].body).toEqual({
      data: {
        name: "Room.Joined",
        payload: { member: "Adam" },
        tags: ["room-7"],
      },
      tags: ["room-7"],
      client: "client-1",
    });
  });

  it("delivers the local leg of a private dispatch to the sender's own subscribers", async () => {
    const source = renderHarness();
    if (!source) throw new Error("no connection opened");
    connect(source);

    await act(async () => {
      await handle?.dispatch(Actions.JoinRoom, { id: 7 });
    });

    expect(received).toHaveBeenCalledWith("Adam");
  });

  it("reports tag.has with all-of semantics after mutations", async () => {
    const source = renderHarness();
    if (!source) throw new Error("no connection opened");
    connect(source);

    await act(async () => {
      await handle?.dispatch(Actions.JoinRoom, { id: 7 });
    });

    expect(holding).toHaveBeenCalledWith(true, false);
  });

  it("does not repeat server mutations for tags the connection already holds", async () => {
    const source = renderHarness();
    if (!source) throw new Error("no connection opened");
    connect(source);

    await act(async () => {
      await handle?.dispatch(Actions.JoinRoom, { id: 7 });
      await handle?.dispatch(Actions.JoinRoom, { id: 7 });
    });

    const puts = sends().filter((call) => call.method === "PUT");
    expect(puts).toHaveLength(1);
  });

  it("dispatches a validated public envelope into the boundary", async () => {
    const source = renderHarness();
    if (!source) throw new Error("no connection opened");
    connect(source);

    act(() => {
      source.emit("message", {
        name: "Room.Joined",
        payload: { member: "Maria" },
      });
    });

    await waitFor(() => expect(received).toHaveBeenCalledWith("Maria"));
    expect(faulted).not.toHaveBeenCalled();
  });

  it("delivers tagged envelopes when the client holds every required tag", async () => {
    const source = renderHarness({ tags: ["room-7"] });
    if (!source) throw new Error("no connection opened");
    connect(source, ["room-7"]);

    act(() => {
      source.emit("message", {
        name: "Room.Joined",
        payload: { member: "Maria" },
        tags: ["room-7"],
      });
    });

    await waitFor(() => expect(received).toHaveBeenCalledWith("Maria"));
  });

  it("silently drops envelopes whose tags the client no longer holds", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const source = renderHarness();
    if (!source) throw new Error("no connection opened");
    connect(source);

    act(() => {
      source.emit("message", {
        name: "Room.Joined",
        payload: { member: "Maria" },
        tags: ["room-7"],
      });
    });

    expect(received).not.toHaveBeenCalled();
    expect(faulted).not.toHaveBeenCalled();
    expect(warn).not.toHaveBeenCalled();
  });

  it("rejects invalid payloads through Lifecycle.Fault with Reason.Rejected", async () => {
    const source = renderHarness();
    if (!source) throw new Error("no connection opened");
    connect(source);

    act(() => {
      source.emit("message", {
        name: "Room.Joined",
        payload: { member: 5 },
      });
    });

    await waitFor(() => expect(faulted).toHaveBeenCalledOnce());
    const fault = faulted.mock.calls[0][0] as Fault;
    expect(fault.reason).toBe(Reason.Rejected);
    expect(fault.error.name).toBe("RejectError");
    expect(fault.action).toBe("Room.Joined");
    expect(received).not.toHaveBeenCalled();
  });

  it("ignores envelopes naming actions outside the allow-list", async () => {
    const source = renderHarness();
    if (!source) throw new Error("no connection opened");
    connect(source);

    act(() => {
      source.emit("message", { name: "Room.Left", payload: {} });
    });

    expect(received).not.toHaveBeenCalled();
    expect(faulted).not.toHaveBeenCalled();
  });

  it("applies channel filtering to incoming channeled envelopes", async () => {
    const source = renderHarness();
    if (!source) throw new Error("no connection opened");
    connect(source);

    act(() => {
      source.emit("message", {
        name: "Room.Renamed",
        payload: { member: "Ada" },
        channel: { Id: 2 },
      });
    });
    expect(renamed).not.toHaveBeenCalled();

    act(() => {
      source.emit("message", {
        name: "Room.Renamed",
        payload: { member: "Ada" },
        channel: { Id: 1 },
      });
    });
    await waitFor(() => expect(renamed).toHaveBeenCalledWith("Ada"));
  });

  it("embeds the channel in outgoing envelopes of channeled dispatches", async () => {
    const source = renderHarness();
    if (!source) throw new Error("no connection opened");
    connect(source);

    await act(async () => {
      await handle?.dispatch(
        Actions.Omnicast.Room.Renamed({ Id: 1 }),
        Audience.Public(),
        { member: "Ada" },
      );
    });

    const post = sends().find((call) => call.method === "POST");
    expect(post?.body).toEqual({
      data: {
        name: "Room.Renamed",
        payload: { member: "Ada" },
        channel: { Id: 1 },
      },
      client: "client-1",
    });
    expect(renamed).toHaveBeenCalledWith("Ada");
  });

  it("degrades omnicast dispatches to plain broadcasts without an sse config", async () => {
    renderHarness({ omit: true });

    await act(async () => {
      await handle?.dispatch(Actions.Omnicast.Room.Joined, Audience.Public(), {
        member: "Solo",
      });
    });

    expect(received).toHaveBeenCalledWith("Solo");
    expect(sends()).toHaveLength(0);
    expect(FakeEventSource.instances).toHaveLength(0);
  });
});
