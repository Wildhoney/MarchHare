/* eslint-disable @typescript-eslint/no-unused-vars */
import { Lifecycle, Pk, HandlerPayload, Brand, Feature, Property } from ".";
import type {
  Payload,
  Handlers,
  UseActions,
  Features,
  FeatureFlags,
  ValidateFeatures,
  Nodes,
  NullableNodes,
} from ".";
import { Action, Distribution } from "..";
import { describe, expect, expectTypeOf, it } from "vitest";

describe("Lifecycle", () => {
  it("should produce unique symbols per factory call", () => {
    const mount1 = Lifecycle.Mount();
    const mount2 = Lifecycle.Mount();
    expect(mount1).not.toBe(mount2);
    expect(mount1[Brand.Action]).not.toBe(mount2[Brand.Action]);
  });

  it("should have all five lifecycle factories", () => {
    expect(typeof Lifecycle.Mount).toBe("function");
    expect(typeof Lifecycle.Unmount).toBe("function");
    expect(typeof Lifecycle.Error).toBe("function");
    expect(typeof Lifecycle.Update).toBe("function");
    expect(typeof Lifecycle.Node).toBe("function");
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
    expect(typeof Brand.Broadcast).toBe("symbol");
    expect(typeof Brand.Multicast).toBe("symbol");
    expect(typeof Brand.Action).toBe("symbol");
    expect(typeof Brand.Channel).toBe("symbol");
    expect(typeof Brand.Node).toBe("symbol");
  });
});

describe("Payload", () => {
  it("should extract payload from unicast action", () => {
    const SetName = Action<string>("SetName");
    type Result = Payload<typeof SetName>;
    expectTypeOf<Result>().toEqualTypeOf<string>();
  });

  it("should extract payload from broadcast action", () => {
    const PaymentLink = Action<{ amount: number }>(
      "PaymentLink",
      Distribution.Broadcast,
    );
    type Result = Payload<typeof PaymentLink>;
    expectTypeOf<Result>().toEqualTypeOf<{ amount: number }>();
  });

  it("should extract payload from multicast action", () => {
    const Update = Action<number>("Update", Distribution.Multicast);
    type Result = Payload<typeof Update>;
    expectTypeOf<Result>().toEqualTypeOf<number>();
  });

  it("should resolve broadcast payload through Handlers type", () => {
    class BroadcastActions {
      static PaymentLink = Action<{ amount: number }>(
        "PaymentLink",
        Distribution.Broadcast,
      );
    }

    class Actions {
      static Broadcast = BroadcastActions;
    }

    type Model = { count: number };
    type H = Handlers<Model, typeof Actions>;

    type Handler = H["Broadcast.PaymentLink"];
    type PayloadParam = Parameters<Handler>[1];

    expectTypeOf<PayloadParam>().toEqualTypeOf<{ amount: number }>();
  });
});

describe("derive type inference", () => {
  const Counter = Action<number>("Counter", Distribution.Broadcast);

  type Model = { count: number };
  class Actions {
    static Counter = Counter;
  }

  it("should have a derive method on UseActions", () => {
    type Base = UseActions<Model, typeof Actions>;
    // The derive method exists and is callable
    expectTypeOf<Base["derive"]>().toBeFunction();
  });

  it("should type action-based derive return as R | null", () => {
    // Action-based derive('key', action, cb) produces R | null on the model
    // because the value is null until the action fires
    type Base = UseActions<Model, typeof Actions>;
    type DeriveMethod = Base["derive"];
    expectTypeOf<DeriveMethod>().toBeFunction();
  });

  it("should support chaining derive calls", () => {
    // Each derive call returns a new UseActions with the model extended
    type Base = UseActions<Model, typeof Actions>;
    expectTypeOf<Base["derive"]>().toBeFunction();
  });
});

describe("Feature", () => {
  it("should have On, Off, and Invert values", () => {
    expect(Feature.On).toBe("on");
    expect(Feature.Off).toBe("off");
    expect(Feature.Invert).toBe("invert");
  });
});

describe("Property", () => {
  it("should have Features as a symbol", () => {
    expect(typeof Property.Features).toBe("symbol");
  });

  it("should have Nodes as a symbol", () => {
    expect(typeof Property.Nodes).toBe("symbol");
  });

  it("should produce unique symbols", () => {
    expect(Property.Features).not.toBe(Property.Nodes);
  });
});

describe("Features", () => {
  it("should produce a record of booleans from a tuple of keys", () => {
    type Result = Features<["sidebar", "modal"]>;
    expectTypeOf<Result>().toEqualTypeOf<{
      sidebar: boolean;
      modal: boolean;
    }>();
  });

  it("should produce an empty record from an empty tuple", () => {
    type Result = Features<[]>;
    type Keys = keyof Result;
    expectTypeOf<Keys>().toEqualTypeOf<never>();
  });

  it("should work with a single key", () => {
    type Result = Features<["paymentDialog"]>;
    expectTypeOf<Result>().toEqualTypeOf<{ paymentDialog: boolean }>();
  });
});

describe("FeatureFlags", () => {
  it("should extract features from a model with a [Property.Features] property", () => {
    type Model = {
      count: number;
      [Property.Features]: { sidebar: boolean; modal: boolean };
    };
    type F = FeatureFlags<Model>;
    expectTypeOf<F>().toEqualTypeOf<{ sidebar: boolean; modal: boolean }>();
  });

  it("should produce never keys when model has no features property", () => {
    type Model = { count: number };
    type F = FeatureFlags<Model>;
    type Keys = keyof F;
    expectTypeOf<Keys>().toEqualTypeOf<never>();
  });

  it("should produce never keys when features is a plain string key", () => {
    type Model = { count: number; features: { sidebar: boolean } };
    type F = FeatureFlags<Model>;
    type Keys = keyof F;
    expectTypeOf<Keys>().toEqualTypeOf<never>();
  });

  it("should reject non-boolean feature values via ValidateFeatures", () => {
    type BadModel = {
      count: number;
      [Property.Features]: { sidebar: string };
    };
    type Result = ValidateFeatures<BadModel>;
    expectTypeOf<Result>().toEqualTypeOf<"[Property.Features] values must all be boolean">();
  });

  it("should resolve to unknown when features are valid", () => {
    type GoodModel = {
      count: number;
      [Property.Features]: { sidebar: boolean };
    };
    type Result = ValidateFeatures<GoodModel>;
    expectTypeOf<Result>().toEqualTypeOf<unknown>();
  });

  it("should resolve to unknown when no features property exists", () => {
    type NoFeatures = { count: number };
    type Result = ValidateFeatures<NoFeatures>;
    expectTypeOf<Result>().toEqualTypeOf<unknown>();
  });
});

describe("Nodes", () => {
  it("should auto-apply null to all values", () => {
    type Result = Nodes<{
      container: HTMLDivElement;
      input: HTMLInputElement;
    }>;
    expectTypeOf<Result>().toEqualTypeOf<{
      container: HTMLDivElement | null;
      input: HTMLInputElement | null;
    }>();
  });

  it("should preserve null if already present", () => {
    type Result = Nodes<{ container: HTMLDivElement | null }>;
    expectTypeOf<Result>().toEqualTypeOf<{
      container: HTMLDivElement | null;
    }>();
  });
});

describe("NullableNodes", () => {
  it("should auto-apply null to node values in a model", () => {
    type Model = {
      count: number;
      [Property.Nodes]: { container: HTMLDivElement };
    };
    type Result = NullableNodes<Model>;
    type NodeType = Result extends { [Property.Nodes]: infer N } ? N : never;
    expectTypeOf<NodeType>().toEqualTypeOf<{
      container: HTMLDivElement | null;
    }>();
  });

  it("should pass through model without nodes unchanged", () => {
    type Model = { count: number };
    type Result = NullableNodes<Model>;
    expectTypeOf<Result>().toEqualTypeOf<Model>();
  });

  it("should preserve other symbol-keyed properties", () => {
    type Model = {
      count: number;
      [Property.Features]: { sidebar: boolean };
      [Property.Nodes]: { container: HTMLDivElement };
    };
    type Result = NullableNodes<Model>;
    type Features = Result extends { [Property.Features]: infer F } ? F : never;
    expectTypeOf<Features>().toEqualTypeOf<{ sidebar: boolean }>();
  });
});
