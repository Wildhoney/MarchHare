import { Lifecycle, Pk, HandlerPayload, Brand } from ".";
import { describe, expect, it } from "vitest";

describe("Lifecycle", () => {
  it("should have unique symbols", () => {
    const symbols = Object.values(Lifecycle);
    const uniqueSymbols = new Set(symbols);
    expect(symbols.length).toBe(uniqueSymbols.size);
  });
});

describe("Pk", () => {
  it("can be a symbol", () => {
    const pk: Pk<never> = Symbol("test");
    expect(typeof pk).toBe("symbol");
  });

  it("can be undefined", () => {
    const pk: Pk<never> = undefined;
    expect(pk).toBeUndefined();
  });
});

describe("HandlerPayload", () => {
  it("should be a symbol", () => {
    const payload = <HandlerPayload<unknown>>Symbol("test");
    expect(typeof payload).toBe("symbol");
  });
});

describe("Brand", () => {
  it("should have symbol properties", () => {
    expect(typeof Brand.Payload).toBe("symbol");
    expect(typeof Brand.Distributed).toBe("symbol");
    expect(typeof Brand.Action).toBe("symbol");
    expect(typeof Brand.Channel).toBe("symbol");
    expect(typeof Brand.Element).toBe("symbol");
  });
});
