import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { Action } from "../../../action/index.ts";
import { isOmnicastAction, schemaOf } from "../../../action/utils.ts";
import { Distribution } from "../../../types/index.ts";
import { address, eligible, lookup, parse, reconcile } from "./utils.ts";

const cat = z.object({ id: z.string(), name: z.string() });

class Omnicast {
  static Cat = class {
    static Adopted = Action("Cat.Adopted", Distribution.Omnicast(cat));
  };
  static Cattery = class {
    static Opened = Action("Cattery.Opened", Distribution.Omnicast());
  };
}

class Wire {
  static Adopted = Action("Cat.Adopted", Distribution.Omnicast(cat));
  static Added = Action<string>("Cat.Added", Distribution.Broadcast);
  static Local = Action<number>("Cat.Local");
}

describe("Distribution.Omnicast()", () => {
  it("creates a broadcast-compatible omnicast action", () => {
    expect(isOmnicastAction(Wire.Adopted)).toBe(true);
    expect(schemaOf(Wire.Adopted)).toBe(cat);
  });

  it("carries a null schema for payloadless events", () => {
    expect(schemaOf(Omnicast.Cattery.Opened)).toBeNull();
  });

  it("does not brand plain broadcast or unicast actions", () => {
    expect(isOmnicastAction(Wire.Added)).toBe(false);
    expect(isOmnicastAction(Wire.Local)).toBe(false);
    expect(schemaOf(Wire.Added)).toBeNull();
  });
});

describe("lookup()", () => {
  it("finds an omnicast action on a flat wire class", () => {
    expect(lookup(Wire, "Cat.Adopted")).toBe(Wire.Adopted);
  });

  it("walks nested namespaces of omnicast actions", () => {
    expect(lookup(Omnicast, "Cat.Adopted")).toBe(Omnicast.Cat.Adopted);
    expect(lookup(Omnicast, "Cattery.Opened")).toBe(Omnicast.Cattery.Opened);
  });

  it("ignores plain broadcast and unicast members", () => {
    expect(lookup(Wire, "Cat.Added")).toBeNull();
    expect(lookup(Wire, "Cat.Local")).toBeNull();
  });

  it("returns null for names outside the configured actions", () => {
    expect(lookup(Omnicast, "Cat.Removed")).toBeNull();
  });
});

describe("reconcile()", () => {
  it("is a no-op when the server already holds the desired tags", () => {
    expect(reconcile(new Set(["vip"]), ["vip"])).toEqual({
      add: [],
      remove: [],
    });
  });

  it("adds tags the server is missing", () => {
    expect(reconcile(new Set(["vip", "beta"]), ["vip"])).toEqual({
      add: ["beta"],
      remove: [],
    });
  });

  it("removes tags the client no longer wants", () => {
    expect(reconcile(new Set(), ["vip", "beta"])).toEqual({
      add: [],
      remove: ["vip", "beta"],
    });
  });
});

describe("address()", () => {
  it("omits the query string without tags", () => {
    expect(address("http://localhost:8080", new Set())).toBe(
      "http://localhost:8080/sse",
    );
  });

  it("appends the tags as a comma-separated query", () => {
    expect(address("http://localhost:8080", new Set(["vip", "beta"]))).toBe(
      "http://localhost:8080/sse?tags=vip%2Cbeta",
    );
  });
});

describe("eligible()", () => {
  it("delivers public envelopes regardless of held tags", () => {
    expect(eligible(undefined, new Set())).toBe(true);
    expect(eligible([], new Set(["vip"]))).toBe(true);
  });

  it("delivers when the client still holds every required tag", () => {
    expect(eligible(["vip"], new Set(["vip", "beta"]))).toBe(true);
    expect(eligible(["vip", "beta"], new Set(["vip", "beta"]))).toBe(true);
  });

  it("rejects when a required tag was shed while the event was in flight", () => {
    expect(eligible(["vip"], new Set(["beta"]))).toBe(false);
    expect(eligible(["vip", "beta"], new Set(["vip"]))).toBe(false);
    expect(eligible(["vip"], new Set())).toBe(false);
  });
});

describe("parse()", () => {
  it("parses a well-formed envelope", () => {
    expect(parse<{ name: string }>('{"name":"Cat.Adopted"}')).toEqual({
      name: "Cat.Adopted",
    });
  });

  it("absorbs malformed JSON into null", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(parse("not json")).toBeNull();
    expect(warn).toHaveBeenCalledOnce();
    warn.mockRestore();
  });
});
