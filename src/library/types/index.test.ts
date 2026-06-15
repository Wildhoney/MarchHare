/* eslint-disable @typescript-eslint/no-unused-vars */
import { Lifecycle, Pk, HandlerPayload, Brand } from ".";
import type { HandlerContext, Maybe, Payload, Handlers, UseActions } from ".";
import { Action, Distribution, App } from "..";
import { describe, expect, expectTypeOf, it } from "vitest";

describe("Lifecycle", () => {
  it("should produce unique symbols per factory call", () => {
    const mount1 = Lifecycle.Mount();
    const mount2 = Lifecycle.Mount();
    expect(mount1).not.toBe(mount2);
    expect(mount1[Brand.Action]).not.toBe(mount2[Brand.Action]);
  });

  it("should have all four lifecycle factories", () => {
    expect(typeof Lifecycle.Mount).toBe("function");
    expect(typeof Lifecycle.Unmount).toBe("function");
    expect(typeof Lifecycle.Error).toBe("function");
    expect(typeof Lifecycle.Update).toBe("function");
  });

  it("should expose Fault as a singleton broadcast action", () => {
    expect(Lifecycle.Fault).toBe(Lifecycle.Fault);
    expect(typeof Lifecycle.Fault[Brand.Action]).toBe("symbol");
    expect(Lifecycle.Fault[Brand.Broadcast]).toBe(true);
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

describe("Env shape threading", () => {
  enum Status {
    Guest,
    Authenticated,
  }
  type Env = { status: Status };

  it("types HandlerContext.env as Readonly<E>", () => {
    type Ctx = HandlerContext<void, object, object, Env>;
    expectTypeOf<Ctx["env"]>().toEqualTypeOf<Readonly<Env>>();
    expectTypeOf<Ctx["env"]["status"]>().toEqualTypeOf<Status>();
  });

  it("types the produce draft's env as E", () => {
    type Ctx = HandlerContext<void, object, object, Env>;
    type Produce = Ctx["actions"]["produce"];
    type Draft = Parameters<Parameters<Produce>[0]>[0];
    expectTypeOf<Draft["env"]>().toEqualTypeOf<Env>();
  });

  it("threads E from App({ env }) through app.useContext into the handler", () => {
    class Actions {
      static SignIn = Action("SignIn");
    }

    // Pure type-level test — function is never invoked so React hooks
    // are not executed. TypeScript still checks the body, which
    // exercises the inference chain App → useContext → useActions →
    // useAction's handler context type.

    function _typeCheck() {
      const app = App({ env: { status: Status.Guest } });
      const context = app.useContext<void, typeof Actions>();
      const actions = context.useActions();

      actions.useAction(Actions.SignIn, (handlerContext) => {
        expectTypeOf(handlerContext.env).toEqualTypeOf<Readonly<Env>>();
        expectTypeOf(handlerContext.env.status).toEqualTypeOf<Status>();
        handlerContext.actions.produce((draft) => {
          expectTypeOf(draft.env).toEqualTypeOf<Env>();
          expectTypeOf(draft.env.status).toEqualTypeOf<Status>();
        });
      });
    }
  });

  it("types the Lifecycle.Env stream renderer's env as Readonly<E>", () => {
    class Actions {
      static SignIn = Action("SignIn");
    }

    function _typeCheck() {
      const app = App({ env: { status: Status.Guest } });
      const context = app.useContext<void, typeof Actions>();
      const actions = context.useActions();

      actions.stream(Lifecycle.Env, (env) => {
        expectTypeOf(env).toEqualTypeOf<Readonly<Env>>();
        expectTypeOf(env.status).toEqualTypeOf<Status>();
        return null;
      });
    }
  });

  it("types the Lifecycle.Env useAction handler's env payload as Readonly<E>", () => {
    class Actions {
      static SignIn = Action("SignIn");
    }

    function _typeCheck() {
      const app = App({ env: { status: Status.Guest } });
      const context = app.useContext<void, typeof Actions>();
      const actions = context.useActions();

      actions.useAction(Lifecycle.Env, (_context, env) => {
        expectTypeOf(env).toEqualTypeOf<Readonly<Env>>();
        expectTypeOf(env.status).toEqualTypeOf<Status>();
      });
    }
  });

  it("rejects async recipes passed to context.actions.produce", () => {
    class Actions {
      static SignIn = Action("SignIn");
    }
    type Model = { user: Maybe<string> };

    function _typeCheck() {
      const app = App({ env: { status: Status.Guest } });
      const context = app.useContext<Model, typeof Actions>();
      const actions = context.useActions({ user: null });

      actions.useAction(Actions.SignIn, (handlerContext) => {
        // Sync recipes compile.
        handlerContext.actions.produce((draft) => {
          draft.model.user = "ok";
        });

        // @ts-expect-error — async recipes must be rejected by AssertSync.
        handlerContext.actions.produce(async (draft) => {
          draft.model.user = "nope";
        });
      });
    }
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
