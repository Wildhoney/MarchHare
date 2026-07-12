import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { Action } from "../action/index.ts";
import { Omnicast } from "../omnicast/index.ts";
import { Distribution } from "../types/index.ts";
import { address, lookup, parse, reconcile } from "./utils.ts";

const cat = z.object({ id: z.string(), name: z.string() });

class Wire {
  static Adopted = Omnicast("Cat.Adopted", cat);
  static Opened = Omnicast("Cattery.Opened");
  static Added = Action<string>("Cat.Added", Distribution.Broadcast);
  static Local = Action<number>("Cat.Local");
}

describe("lookup()", () => {
  it("finds an omnicast action by its envelope name", () => {
    expect(lookup(Wire, "Cat.Adopted")).toBe(Wire.Adopted);
    expect(lookup(Wire, "Cattery.Opened")).toBe(Wire.Opened);
  });

  it("ignores plain broadcast and unicast members of the wire class", () => {
    expect(lookup(Wire, "Cat.Added")).toBeNull();
    expect(lookup(Wire, "Cat.Local")).toBeNull();
  });

  it("returns null for names outside the wire class", () => {
    expect(lookup(Wire, "Cat.Removed")).toBeNull();
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
