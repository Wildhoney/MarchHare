import {
  describe,
  expect,
  it,
  jest,
  beforeEach,
  afterEach,
} from "@jest/globals";
import { use, context, entries, polls } from "./index.ts";
import { Payload, Status } from "../types/index.ts";
import { Args } from "./types.ts";
import { AbortError, TimeoutError } from "../error/types.ts";

/**
 * Creates a mock context object for testing action decorators.
 */
function createMockContext(overrides: Partial<Args> = {}): Args {
  const controller = new AbortController();
  return {
    model: {},
    signal: controller.signal,
    actions: {
      produce: jest.fn((fn) => {
        const model = {};
        fn(model);
        return model;
      }),
      dispatch: jest.fn(),
      annotate: jest.fn((_, value) => value),
    },
    [context]: { controller },
    ...overrides,
  } as Args;
}

/**
 * Helper to wait for a specified number of milliseconds.
 */
function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe("use.supplant()", () => {
  it("should abort previous action when dispatched again", async () => {
    const abortedSignals: boolean[] = [];

    class TestActions {
      @use.supplant()
      async action(args: Args) {
        abortedSignals.push(args.signal.aborted);
        await wait(50);
        abortedSignals.push(args.signal.aborted);
        return "done";
      }
    }

    const instance = new TestActions();
    const ctx1 = createMockContext();
    const ctx2 = createMockContext();

    const promise1 = instance.action(ctx1);
    await wait(10);
    const promise2 = instance.action(ctx2);

    await Promise.allSettled([promise1, promise2]);

    // First action should have been aborted
    expect(ctx1.signal.aborted).toBe(true);
    // Second action should complete normally
    expect(ctx2.signal.aborted).toBe(false);
  });

  it("should allow action to complete when not interrupted", async () => {
    class TestActions {
      @use.supplant()
      async action(_args: Args) {
        await wait(10);
        return "completed";
      }
    }

    const instance = new TestActions();
    const ctx = createMockContext();

    const result = await instance.action(ctx);
    expect(result).toBe("completed");
    expect(ctx.signal.aborted).toBe(false);
  });

  it("should handle multiple sequential calls correctly", async () => {
    const calls: number[] = [];

    class TestActions {
      @use.supplant()
      async action(_args: Args) {
        const id = Date.now();
        calls.push(id);
        await wait(20);
        return id;
      }
    }

    const instance = new TestActions();

    await instance.action(createMockContext());
    await instance.action(createMockContext());
    await instance.action(createMockContext());

    expect(calls.length).toBe(3);
  });
});

describe("use.reactive()", () => {
  // Helper to create a typed action symbol for tests
  const createTestAction = <T>(): Payload<T> =>
    Symbol("test.action") as Payload<T>;

  it("should register dependencies in the entries WeakMap", () => {
    const TestAction = createTestAction<never>();
    const getDeps = () => ["test", 42, true];

    class TestActions {
      @use.reactive(getDeps)
      [TestAction] = async (_args: Args) => {
        return "done";
      };
    }

    const instance = new TestActions();
    const registeredEntries = entries.get(instance);

    expect(registeredEntries).toBeDefined();
    expect(registeredEntries?.size).toBe(1);

    const [entry] = [...(registeredEntries ?? [])];
    expect(entry.action).toBe(TestAction);
  });

  it("should register multiple reactive decorators on different methods", () => {
    const Action1 = createTestAction<never>();
    const Action2 = createTestAction<never>();
    const getDeps1 = () => ["test"];
    const getDeps2 = () => [1, 2, 3];

    class TestActions {
      @use.reactive(getDeps1)
      [Action1] = async (_args: Args) => {
        return "one";
      };

      @use.reactive(getDeps2)
      [Action2] = async (_args: Args) => {
        return "two";
      };
    }

    const instance = new TestActions();
    const registeredEntries = entries.get(instance);

    expect(registeredEntries?.size).toBe(2);

    const actions = [...(registeredEntries ?? [])].map((e) => e.action);
    expect(actions).toContain(Action1);
    expect(actions).toContain(Action2);
  });

  it("should store getDependencies function that returns correct values", () => {
    const CounterAction = createTestAction<never>();
    let counter = 0;
    const getDeps = () => [counter++];

    class TestActions {
      @use.reactive(getDeps)
      [CounterAction] = async (_args: Args) => {
        return "done";
      };
    }

    const instance = new TestActions();
    const registeredEntries = entries.get(instance);
    const [entry] = [...(registeredEntries ?? [])];
    const ctx = { model: {}, inspect: {} };

    // getDependencies should return incrementing values
    expect(entry.getDependencies(ctx)).toEqual([0]);
    expect(entry.getDependencies(ctx)).toEqual([1]);
    expect(entry.getDependencies(ctx)).toEqual([2]);
  });

  it("should pass context with model and inspect to getDependencies", () => {
    type TestPayload = { doubled: number };
    const TestAction = createTestAction<TestPayload>();
    const getDependencies = jest.fn((context: { model: { count: number } }) => [
      context.model.count,
    ]);
    const getPayload = jest.fn((context: { model: { count: number } }) => ({
      doubled: context.model.count * 2,
    }));

    class TestActions {
      @use.reactive(getDependencies, getPayload)
      [TestAction] = async (_args: Args) => {
        return "done";
      };
    }

    const instance = new TestActions();
    const registeredEntries = entries.get(instance);
    const [entry] = [...(registeredEntries ?? [])];

    // Call getDependencies with context
    const context = { model: { count: 5 }, inspect: {} };
    const deps = entry.getDependencies(context);

    expect(deps).toEqual([5]);
    expect(getDependencies).toHaveBeenCalledWith(context);
  });

  it("should pass context with model and inspect to getPayload", () => {
    type TestPayload = { doubled: number };
    const TestAction = createTestAction<TestPayload>();
    const getDependencies = jest.fn((context: { model: { count: number } }) => [
      context.model.count,
    ]);
    const getPayload = jest.fn((context: { model: { count: number } }) => ({
      doubled: context.model.count * 2,
    }));

    class TestActions {
      @use.reactive(getDependencies, getPayload)
      [TestAction] = async (_args: Args) => {
        return "done";
      };
    }

    const instance = new TestActions();
    const registeredEntries = entries.get(instance);
    const [entry] = [...(registeredEntries ?? [])];

    // Call getPayload with context
    const context = { model: { count: 7 }, inspect: {} };
    const payload = entry.getPayload!(context);

    expect(payload).toEqual({ doubled: 14 });
    expect(getPayload).toHaveBeenCalledWith(context);
  });

  it("should support no-payload actions with context-aware dependencies", () => {
    const TestAction = createTestAction<never>();
    const getDependencies = jest.fn(
      (context: { model: { filters: string[] } }) => [
        context.model.filters.length,
      ],
    );

    class TestActions {
      @use.reactive(getDependencies)
      [TestAction] = async (_args: Args) => {
        return "done";
      };
    }

    const instance = new TestActions();
    const registeredEntries = entries.get(instance);
    const [entry] = [...(registeredEntries ?? [])];

    // Call getDependencies with context
    const context = { model: { filters: ["a", "b", "c"] }, inspect: {} };
    const deps = entry.getDependencies(context);

    expect(deps).toEqual([3]);
    expect(entry.getPayload).toBeUndefined();
  });
});

describe("use.debug()", () => {
  let consoleGroupSpy: jest.SpiedFunction<typeof console.group>;
  let consoleLogSpy: jest.SpiedFunction<typeof console.log>;
  let consoleGroupEndSpy: jest.SpiedFunction<typeof console.groupEnd>;
  let consoleErrorSpy: jest.SpiedFunction<typeof console.error>;

  beforeEach(() => {
    consoleGroupSpy = jest.spyOn(console, "group").mockImplementation(() => {});
    consoleLogSpy = jest.spyOn(console, "log").mockImplementation(() => {});
    consoleGroupEndSpy = jest
      .spyOn(console, "groupEnd")
      .mockImplementation(() => {});
    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("should log action start and completion", async () => {
    class TestActions {
      @use.debug()
      async myAction(_args: Args) {
        return "result";
      }
    }

    const instance = new TestActions();
    await instance.myAction(createMockContext());

    expect(consoleGroupSpy).toHaveBeenCalledWith("🔧 Action: myAction");
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining("⏱️  Started at:"),
      expect.any(String),
    );
    expect(consoleGroupEndSpy).toHaveBeenCalled();
  });

  it("should track produce calls", async () => {
    class TestActions {
      @use.debug()
      async myAction(args: Args) {
        args.actions.produce(() => {});
        args.actions.produce(() => {});
        return "done";
      }
    }

    const instance = new TestActions();
    await instance.myAction(createMockContext());

    // Should log produce timing for each call
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringMatching(/📝 produce #1:/),
    );
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringMatching(/📝 produce #2:/),
    );
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining("Total produce calls: 2"),
    );
  });

  it("should log errors when action fails", async () => {
    const error = new Error("Test error");

    class TestActions {
      @use.debug()
      async failingAction(_args: Args): Promise<string> {
        throw error;
      }
    }

    const instance = new TestActions();

    await expect(instance.failingAction(createMockContext())).rejects.toThrow(
      "Test error",
    );

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "❌ Error in failingAction:",
      error,
    );
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringMatching(/Failed after:/),
    );
    expect(consoleGroupEndSpy).toHaveBeenCalled();
  });

  it("should return the action result", async () => {
    class TestActions {
      @use.debug()
      async myAction(_args: Args) {
        return { success: true, data: 42 };
      }
    }

    const instance = new TestActions();
    const result = await instance.myAction(createMockContext());

    expect(result).toEqual({ success: true, data: 42 });
  });
});

describe("use.debounce()", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("should delay action execution", async () => {
    const calls: number[] = [];

    class TestActions {
      @use.debounce(100)
      async action(_args: Args) {
        calls.push(Date.now());
        return "done";
      }
    }

    const instance = new TestActions();
    const promise = instance.action(createMockContext());

    expect(calls.length).toBe(0);

    await jest.advanceTimersByTimeAsync(100);
    await promise;

    expect(calls.length).toBe(1);
  });

  it("should cancel previous call when called again within delay", async () => {
    const calls: string[] = [];

    class TestActions {
      @use.debounce(100)
      async action(_args: Args) {
        calls.push("executed");
        return "done";
      }
    }

    const instance = new TestActions();

    const promise1 = instance.action(createMockContext());
    await jest.advanceTimersByTimeAsync(50);

    const promise2 = instance.action(createMockContext());
    await jest.advanceTimersByTimeAsync(50);

    const promise3 = instance.action(createMockContext());

    // First two should reject with AbortError
    await expect(promise1).rejects.toThrow(AbortError);
    await expect(promise2).rejects.toThrow(AbortError);

    // Advance time to trigger the last call
    await jest.advanceTimersByTimeAsync(100);
    await promise3;

    // Only the last call should have executed
    expect(calls.length).toBe(1);
  });

  /**
   * Verifies that aborting via the controller's signal cancels the pending
   * debounced execution and cleans up the timer, preventing the action from running.
   */
  it("should cleanup on abort signal", async () => {
    const calls: string[] = [];

    class TestActions {
      @use.debounce(100)
      async action(_args: Args) {
        calls.push("executed");
        return "done";
      }
    }

    const instance = new TestActions();
    const ctx = createMockContext();

    const promise = instance.action(ctx);

    // Abort before the debounce fires - rejection happens immediately
    await jest.advanceTimersByTimeAsync(50);
    ctx[context].controller.abort();

    // The promise should reject with AbortError immediately on abort
    await expect(promise).rejects.toThrow(AbortError);

    // The action should not execute due to abort
    expect(calls.length).toBe(0);
  });
});

describe("use.throttle()", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("should execute immediately on first call", async () => {
    const calls: number[] = [];

    class TestActions {
      @use.throttle(100)
      async action(_args: Args) {
        calls.push(Date.now());
        return "done";
      }
    }

    const instance = new TestActions();
    const promise = instance.action(createMockContext());

    // First call should execute immediately
    await promise;
    expect(calls.length).toBe(1);
  });

  it("should queue subsequent calls during throttle window", async () => {
    const calls: string[] = [];

    class TestActions {
      @use.throttle(100)
      async action(_args: Args) {
        calls.push("executed");
        return "done";
      }
    }

    const instance = new TestActions();

    // First call executes immediately
    const promise1 = instance.action(createMockContext());
    await promise1;
    expect(calls.length).toBe(1);

    // Second call within throttle window - should be queued
    const promise2 = instance.action(createMockContext());

    // Third call replaces the second in the queue
    const promise3 = instance.action(createMockContext());

    await jest.advanceTimersByTimeAsync(100);

    await Promise.all([promise2, promise3]);

    // One immediate + one after throttle window
    expect(calls.length).toBe(2);
  });

  it("should allow time window to reset after it expires", async () => {
    const calls: number[] = [];

    class TestActions {
      @use.throttle(100)
      async action(_args: Args) {
        calls.push(Date.now());
        return "done";
      }
    }

    const instance = new TestActions();

    // First call executes immediately
    await instance.action(createMockContext());
    expect(calls.length).toBe(1);

    // Wait past throttle window
    await jest.advanceTimersByTimeAsync(150);

    // This call should also execute immediately (window expired)
    await instance.action(createMockContext());
    expect(calls.length).toBe(2);
  });
});

describe("use.retry()", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("should succeed on first attempt if no error", async () => {
    const attempts: number[] = [];

    class TestActions {
      @use.retry([100, 200])
      async action(_args: Args) {
        attempts.push(attempts.length + 1);
        return "success";
      }
    }

    const instance = new TestActions();
    const result = await instance.action(createMockContext());

    expect(result).toBe("success");
    expect(attempts.length).toBe(1);
  });

  it("should retry on failure using interval array", async () => {
    let attemptCount = 0;

    class TestActions {
      @use.retry([100, 200]) // 2 retries = 3 total attempts
      async action(_args: Args): Promise<string> {
        attemptCount++;
        if (attemptCount < 3) {
          throw new Error(`Attempt ${attemptCount} failed`);
        }
        return "success";
      }
    }

    const instance = new TestActions();
    const promise = instance.action(createMockContext());

    // First attempt (immediate)
    await jest.advanceTimersByTimeAsync(0);
    expect(attemptCount).toBe(1);

    // Second attempt after 100ms
    await jest.advanceTimersByTimeAsync(100);
    expect(attemptCount).toBe(2);

    // Third attempt after 200ms
    await jest.advanceTimersByTimeAsync(200);
    expect(attemptCount).toBe(3);

    const result = await promise;
    expect(result).toBe("success");
  });

  /**
   * Ensures that after all retry intervals are exhausted, the final error
   * is propagated to the caller rather than being silently swallowed.
   */
  it("should throw after exhausting all intervals", async () => {
    let attemptCount = 0;

    class TestActions {
      @use.retry([50, 50]) // 2 retries = 3 total attempts
      async action(_args: Args): Promise<string> {
        attemptCount++;
        throw new Error(`Attempt ${attemptCount} failed`);
      }
    }

    const instance = new TestActions();
    const promise = instance.action(createMockContext());

    // Advance time to cover all retry intervals (50 + 50 = 100ms total)
    // The rejection happens during this time advance, so we need to catch it properly
    const expectation = expect(promise).rejects.toThrow("Attempt 3 failed");
    await jest.advanceTimersByTimeAsync(100);

    await expectation;
    expect(attemptCount).toBe(3);
  });

  it("should use custom intervals between retries", async () => {
    let attemptCount = 0;

    class TestActions {
      @use.retry([100, 500, 1000]) // 3 retries with varying delays
      async action(_args: Args): Promise<string> {
        attemptCount++;
        if (attemptCount < 4) {
          throw new Error("fail");
        }
        return "success";
      }
    }

    const instance = new TestActions();
    const promise = instance.action(createMockContext());

    // First attempt immediately
    await jest.advanceTimersByTimeAsync(0);
    expect(attemptCount).toBe(1);

    // Second attempt after 100ms
    await jest.advanceTimersByTimeAsync(100);
    expect(attemptCount).toBe(2);

    // Third attempt after 500ms
    await jest.advanceTimersByTimeAsync(500);
    expect(attemptCount).toBe(3);

    // Fourth attempt after 1000ms
    await jest.advanceTimersByTimeAsync(1000);
    expect(attemptCount).toBe(4);

    const result = await promise;
    expect(result).toBe("success");
  });

  it("should use default intervals when none specified", async () => {
    let attemptCount = 0;

    class TestActions {
      @use.retry() // Uses default [1000, 2000, 4000]
      async action(_args: Args): Promise<string> {
        attemptCount++;
        if (attemptCount < 2) {
          throw new Error("fail");
        }
        return "success";
      }
    }

    const instance = new TestActions();
    const promise = instance.action(createMockContext());

    // First attempt
    await jest.advanceTimersByTimeAsync(0);
    expect(attemptCount).toBe(1);

    // Second attempt after default 1000ms
    await jest.advanceTimersByTimeAsync(1000);
    expect(attemptCount).toBe(2);

    const result = await promise;
    expect(result).toBe("success");
  });

  it("should stop retrying when aborted during delay", async () => {
    let attemptCount = 0;

    class TestActions {
      @use.retry([100, 200, 300])
      async action(_args: Args): Promise<string> {
        attemptCount++;
        throw new Error("fail");
      }
    }

    const instance = new TestActions();
    const ctx = createMockContext();
    const promise = instance.action(ctx);

    // First attempt
    await jest.advanceTimersByTimeAsync(0);
    expect(attemptCount).toBe(1);

    // Abort during the delay before second attempt
    await jest.advanceTimersByTimeAsync(50);
    ctx[context].controller.abort();

    await expect(promise).rejects.toThrow(AbortError);
    expect(attemptCount).toBe(1);
  });

  it("should throw AbortError if already aborted", async () => {
    class TestActions {
      @use.retry([100])
      async action(_args: Args) {
        return "success";
      }
    }

    const instance = new TestActions();
    const ctx = createMockContext();
    ctx[context].controller.abort();

    await expect(instance.action(ctx)).rejects.toThrow(AbortError);
  });
});

describe("use.timeout()", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("should complete successfully if within timeout", async () => {
    class TestActions {
      @use.timeout(100)
      async action(_args: Args) {
        return "success";
      }
    }

    const instance = new TestActions();
    const result = await instance.action(createMockContext());

    expect(result).toBe("success");
  });

  it("should reject with TimeoutError and abort signal if action exceeds timeout", async () => {
    let signalAborted = false;

    class TestActions {
      @use.timeout(50)
      async action(args: Args): Promise<string> {
        args.signal.addEventListener("abort", () => {
          signalAborted = true;
        });
        await new Promise((resolve) => setTimeout(resolve, 100));
        return "success";
      }
    }

    const instance = new TestActions();
    const resultPromise = instance
      .action(createMockContext())
      .catch((error) => {
        expect(error).toBeInstanceOf(TimeoutError);
        return "caught";
      });

    await jest.advanceTimersByTimeAsync(60);

    const result = await resultPromise;
    expect(result).toBe("caught");
    expect(signalAborted).toBe(true);
  });

  it("should provide a combined signal that aborts on timeout", async () => {
    let receivedSignal: AbortSignal | null = null;

    class TestActions {
      @use.timeout(100)
      async action(args: Args) {
        receivedSignal = args.signal;
        await new Promise((resolve) => setTimeout(resolve, 50));
        return "done";
      }
    }

    const instance = new TestActions();
    const promise = instance.action(createMockContext());

    await jest.advanceTimersByTimeAsync(50);
    await promise;

    expect(receivedSignal).not.toBeNull();
    expect(receivedSignal?.aborted).toBe(false);
  });

  it("should cleanup timeout on successful completion", async () => {
    const clearTimeoutSpy = jest.spyOn(global, "clearTimeout");

    class TestActions {
      @use.timeout(100)
      async action(_args: Args) {
        return "success";
      }
    }

    const instance = new TestActions();
    await instance.action(createMockContext());

    expect(clearTimeoutSpy).toHaveBeenCalled();
    clearTimeoutSpy.mockRestore();
  });

  it("should respect parent abort signal", async () => {
    let receivedSignal: AbortSignal | null = null;

    class TestActions {
      @use.timeout(1000)
      async action(args: Args): Promise<string> {
        receivedSignal = args.signal;
        await new Promise<void>((resolve, reject) => {
          const timerId = setTimeout(resolve, 500);
          args.signal.addEventListener(
            "abort",
            () => {
              clearTimeout(timerId);
              reject(new AbortError("Parent aborted"));
            },
            { once: true },
          );
        });
        return "success";
      }
    }

    const instance = new TestActions();
    const ctx = createMockContext();
    const promise = instance.action(ctx);

    // Abort from parent before timeout
    await jest.advanceTimersByTimeAsync(100);
    ctx[context].controller.abort();

    await expect(promise).rejects.toThrow("Parent aborted");
    expect(receivedSignal?.aborted).toBe(true);
  });
});

describe("decorator combinations", () => {
  it("should work with debounce decorator on its own when called rapidly", async () => {
    jest.useFakeTimers();
    const calls: string[] = [];

    class TestActions {
      @use.debounce(100)
      async action(_args: Args) {
        calls.push("executed");
        return "done";
      }
    }

    const instance = new TestActions();

    // Rapid calls - only the last should execute
    const promise1 = instance.action(createMockContext());
    const promise2 = instance.action(createMockContext());
    const promise3 = instance.action(createMockContext());

    // First two should reject
    await expect(promise1).rejects.toThrow(AbortError);
    await expect(promise2).rejects.toThrow(AbortError);

    // Advance past debounce window
    await jest.advanceTimersByTimeAsync(100);
    await promise3;

    // Only one should have executed
    expect(calls.length).toBe(1);
    jest.useRealTimers();
  });
});

describe("edge cases", () => {
  // Helper to create a typed action symbol for tests
  const createTestAction = <T>(): Payload<T> =>
    Symbol("test.action") as Payload<T>;

  it("should handle symbol method names in reactive", () => {
    const methodSymbol = createTestAction<never>();
    const getDeps = () => [1, 2, 3];

    class TestActions {
      @use.reactive(getDeps)
      [methodSymbol] = async (_args: Args) => {
        return "done";
      };
    }

    const instance = new TestActions();
    const registeredEntries = entries.get(instance);

    expect(registeredEntries).toBeDefined();
    const [entry] = [...(registeredEntries ?? [])];
    expect(entry.action).toBe(methodSymbol);
  });

  it("should handle multiple instances independently", async () => {
    const calls: { instance: string; aborted: boolean }[] = [];

    class TestActions {
      constructor(public name: string) {}

      @use.supplant()
      async action(args: Args) {
        calls.push({ instance: this.name, aborted: args.signal.aborted });
        return "done";
      }
    }

    const instance1 = new TestActions("A");
    const instance2 = new TestActions("B");

    // Both instances should work independently - supplant is per-instance
    const promise1 = instance1.action(createMockContext());
    const promise2 = instance2.action(createMockContext());

    await Promise.all([promise1, promise2]);

    expect(calls).toContainEqual({ instance: "A", aborted: false });
    expect(calls).toContainEqual({ instance: "B", aborted: false });
  });

  it("should handle errors in produce with debug decorator", async () => {
    const consoleGroupSpy = jest
      .spyOn(console, "group")
      .mockImplementation(() => {});
    const consoleLogSpy = jest
      .spyOn(console, "log")
      .mockImplementation(() => {});
    const consoleGroupEndSpy = jest
      .spyOn(console, "groupEnd")
      .mockImplementation(() => {});

    const produceError = new Error("Produce error");

    class TestActions {
      @use.debug()
      async action(args: Args) {
        args.actions.produce(() => {
          throw produceError;
        });
        return "done";
      }
    }

    const instance = new TestActions();
    const ctx = createMockContext();
    (ctx.actions.produce as jest.Mock).mockImplementation((fn) => {
      fn({});
      throw produceError;
    });

    await expect(instance.action(ctx)).rejects.toThrow("Produce error");

    consoleGroupSpy.mockRestore();
    consoleLogSpy.mockRestore();
    consoleGroupEndSpy.mockRestore();
  });
});

describe("decorator combinations", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  /**
   * Tests that combining @use.supplant() with @use.retry() works correctly.
   * The action should retry on failure even when wrapped with supplant.
   */
  it("should retry when combining supplant and retry", async () => {
    let attemptCount = 0;

    class TestActions {
      @use.supplant()
      @use.retry([100, 100]) // 2 retries = 3 total attempts
      async action(_args: Args): Promise<string> {
        attemptCount++;
        if (attemptCount < 3) {
          throw new Error(`Attempt ${attemptCount} failed`);
        }
        return "success";
      }
    }

    const instance = new TestActions();
    const promise = instance.action(createMockContext());

    // First attempt (immediate)
    await jest.advanceTimersByTimeAsync(0);
    expect(attemptCount).toBe(1);

    // Second attempt after 100ms
    await jest.advanceTimersByTimeAsync(100);
    expect(attemptCount).toBe(2);

    // Third attempt after another 100ms
    await jest.advanceTimersByTimeAsync(100);
    expect(attemptCount).toBe(3);

    const result = await promise;
    expect(result).toBe("success");
  });

  /**
   * Tests that supplant correctly aborts retry sequences when called again.
   * A new call should abort the previous call's entire retry sequence.
   * Note: supplant must be ABOVE retry for correct behavior.
   */
  it("should abort retry sequence when supplant is triggered again", async () => {
    let attemptCount = 0;

    class TestActions {
      @use.supplant()
      @use.retry([100, 100])
      async action(_args: Args): Promise<string> {
        attemptCount++;
        throw new Error(`Attempt ${attemptCount} failed`);
      }
    }

    const instance = new TestActions();
    const ctx1 = createMockContext();
    const ctx2 = createMockContext();

    // Start first call
    const promise1 = instance.action(ctx1);
    await jest.advanceTimersByTimeAsync(0);
    expect(attemptCount).toBe(1);

    // Start second call while first is retrying - should abort first
    const _promise2 = instance.action(ctx2);

    // First call should be aborted
    await expect(promise1).rejects.toThrow(AbortError);
    expect(ctx1.signal.aborted).toBe(true);

    // Second call continues independently
    await jest.advanceTimersByTimeAsync(0);
    expect(attemptCount).toBe(2); // Second call's first attempt
  });
});

describe("@use.poll()", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("should register poll entries with payload in the polls WeakMap", () => {
    const PollAction = Symbol("PollAction") as Payload<{ value: number }>;
    const getPayload = () => ({ value: 42 });
    const getStatus = () => Status.Play;

    class TestActions {
      @use.poll(1000, getPayload, getStatus)
      [PollAction] = async (_args: Args) => {};
    }

    const instance = new TestActions();
    const pollEntries = polls.get(instance);

    expect(pollEntries).toBeDefined();
    expect(pollEntries?.size).toBe(1);

    const entry = Array.from(pollEntries!)[0];
    expect(entry.action).toBe(PollAction);
    expect(entry.interval).toBe(1000);
    expect(entry.getPayload?.({ model: {}, inspect: {} })).toEqual({
      value: 42,
    });
    expect(entry.getStatus({ model: {}, inspect: {} })).toBe(Status.Play);
  });

  it("should register poll entries without payload", () => {
    const PollAction = Symbol("PollAction") as Payload<never>;

    class TestActions {
      @use.poll(1000)
      [PollAction] = async (_args: Args) => {};
    }

    const instance = new TestActions();
    const pollEntries = polls.get(instance);

    expect(pollEntries).toBeDefined();
    expect(pollEntries?.size).toBe(1);

    const entry = Array.from(pollEntries!)[0];
    expect(entry.action).toBe(PollAction);
    expect(entry.interval).toBe(1000);
    expect(entry.getPayload).toBeUndefined();
    expect(entry.getStatus({ model: {}, inspect: {} })).toBe(Status.Play);
  });

  it("should default status to Status.Play when not provided", () => {
    const PollAction = Symbol("PollAction") as Payload<{ data: string }>;

    class TestActions {
      @use.poll(1000, () => ({ data: "test" }))
      [PollAction] = async (_args: Args) => {};
    }

    const instance = new TestActions();
    const pollEntries = polls.get(instance);
    const entry = Array.from(pollEntries!)[0];

    expect(entry.getStatus({ model: {}, inspect: {} })).toBe(Status.Play);
  });

  it("should register multiple poll decorators independently", () => {
    const ActionA = Symbol("ActionA") as Payload<{ a: number }>;
    const ActionB = Symbol("ActionB") as Payload<{ b: number }>;

    class TestActions {
      @use.poll(1000, () => ({ a: 1 }))
      [ActionA] = async (_args: Args) => {};

      @use.poll(2000, () => ({ b: 2 }))
      [ActionB] = async (_args: Args) => {};
    }

    const instance = new TestActions();
    const pollEntries = polls.get(instance);

    expect(pollEntries?.size).toBe(2);

    const entries = Array.from(pollEntries!);
    const intervals = entries.map((e) => e.interval).sort((a, b) => a - b);
    expect(intervals).toEqual([1000, 2000]);
  });

  it("should call getPayload fresh at each interval check", () => {
    const PollAction = Symbol("PollAction") as Payload<{ count: number }>;
    let counter = 0;
    const getPayload = jest.fn(() => ({ count: ++counter }));

    class TestActions {
      @use.poll(100, getPayload)
      [PollAction] = async (_args: Args) => {};
    }

    const instance = new TestActions();
    const pollEntries = polls.get(instance);
    const entry = Array.from(pollEntries!)[0];

    // Simulate what the hook does at each interval
    const ctx = { model: {}, inspect: {} };
    expect(entry.getPayload!(ctx)).toEqual({ count: 1 });
    expect(entry.getPayload!(ctx)).toEqual({ count: 2 });
    expect(entry.getPayload!(ctx)).toEqual({ count: 3 });

    expect(getPayload).toHaveBeenCalledTimes(3);
  });

  it("should work with different poll instances independently", () => {
    const PollAction = Symbol("PollAction") as Payload<never>;

    class TestActions {
      constructor(private interval: number) {}

      @use.poll(1000)
      [PollAction] = async (_args: Args) => {};
    }

    const instance1 = new TestActions(1000);
    const instance2 = new TestActions(2000);

    const polls1 = polls.get(instance1);
    const polls2 = polls.get(instance2);

    // Each instance has its own poll entry set
    expect(polls1).toBeDefined();
    expect(polls2).toBeDefined();
    expect(polls1).not.toBe(polls2);
  });

  it("should pass context with model and inspect to getPayload", () => {
    const PollAction = Symbol("PollAction") as Payload<{ count: number }>;
    const getPayload = jest.fn((context: { model: { value: number } }) => ({
      count: context.model.value * 2,
    }));

    class TestActions {
      @use.poll(100, getPayload)
      [PollAction] = async (_args: Args) => {};
    }

    const instance = new TestActions();
    const pollEntries = polls.get(instance);
    const entry = Array.from(pollEntries!)[0];

    // Call with context containing model
    const context = { model: { value: 5 }, inspect: {} };
    const result = entry.getPayload!(context);

    expect(result).toEqual({ count: 10 });
    expect(getPayload).toHaveBeenCalledWith(context);
  });
});
