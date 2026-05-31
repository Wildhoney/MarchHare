import * as React from "react";
import {
  useLifecycles,
  useData,
  isChanneledAction,
  getActionSymbol,
  matchesChannel,
  useRegisterHandler,
  useDispatchers,
  findLifecycleAction,
  isGenerator,
  emitAsync,
  replay,
} from "./utils.ts";
export { With } from "./utils.ts";
import { useRerender } from "../utils/utils.ts";
import type { Data, Handler, Scope } from "./types.ts";
import {
  HandlerContext,
  Phase,
  Model,
  HandlerPayload,
  Props,
  Actions,
  ActionId,
  UseActions,
  Result,
  Task,
  Filter,
  ChanneledAction,
  ActionOrChanneled,
  AnyAction,
  FaultSymbol,
  StoreSymbol,
  Context as ContextHandle,
} from "../types/index.ts";

import { getReason, getError } from "../error/utils.ts";
import EventEmitter from "eventemitter3";
import { useBroadcast } from "../boundary/components/broadcast/index.tsx";
import { useScope, getScope } from "../boundary/components/scope/index.tsx";
import { useStore, useStoreRef } from "../boundary/components/store/utils.ts";
import type { Store } from "../boundary/components/store/index.tsx";
import { produce as produceImmer } from "immer";
import { consumePending } from "../resource/index.ts";
import type { Coalesce } from "../resource/types.ts";
import { unset } from "../utils/utils.ts";
import {
  isBroadcastAction,
  isMulticastAction,
  getName,
} from "../action/index.ts";
import { State, Operation, Process, Inspect } from "immertation";
import { useTasks } from "../boundary/components/tasks/utils.ts";
import { Partition } from "../boundary/components/consumer/index.tsx";
import type { ConsumerRenderer } from "../boundary/components/consumer/types.ts";
import { G } from "@mobily/ts-belt";
import { useSharing } from "../boundary/components/sharing/index.tsx";

/**
 * Internal sentinels and tunables for the resource chainable.
 *
 * - `defaultToken` &mdash; used when `.coalesce()` is called with no
 *   token. Every untokened caller for the same `(Resource, params)`
 *   slot collapses onto this key.
 *
 * @internal
 */
const config = <const>{
  defaultToken: Symbol("coalesce:default"),
};

function coalesceKey(value: Coalesce): string {
  switch (typeof value) {
    case "string":
      return `s:${value}`;
    case "number":
      return `n:${value}`;
    case "bigint":
      return `i:${value.toString()}`;
    case "boolean":
      return `b:${value}`;
    case "symbol":
      return `y:${value.description ?? String(value)}`;
    default:
      return `o:${JSON.stringify(value)}`;
  }
}

function withAbort<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    if (signal.aborted) {
      reject(signal.reason);
      return;
    }
    const onAbort = (): void => reject(signal.reason);
    signal.addEventListener("abort", onAbort, { once: true });
    promise.then(
      (value) => {
        signal.removeEventListener("abort", onAbort);
        resolve(value);
      },
      (error: unknown) => {
        signal.removeEventListener("abort", onAbort);
        reject(error);
      },
    );
  });
}

/**
 * A hook for managing state with actions.
 *
 * Call `useActions` first, then use `actions.useAction` to bind handlers
 * to action symbols. Types are pre-baked from the generic parameters, so
 * no additional type annotations are needed on handler calls.
 *
 * The hook returns a result containing:
 * 1. The current model state
 * 2. An actions object with `dispatch`, `inspect`, and `useAction`
 * 3. A read-only snapshot of the data values produced by `getData` &mdash;
 *    the same values handlers read via `context.data`, exposed here for
 *    JSX consumption so the view and the handler share one named source.
 *
 * The `inspect` property provides access to Immertation's annotation system,
 * allowing you to check for pending operations on model properties.
 *
 * @template M The model type representing the component's state.
 * @template AC The actions class containing action definitions.
 * @template D The data type for reactive external values.
 * @param initialModel The initial model state.
 * @param getData Optional function that returns reactive values as data.
 *   Values returned are accessible via `context.data` in action handlers,
 *   always reflecting the latest values even after await operations.
 * @returns A result `[model, actions, data]` with pre-typed `useAction` method.
 *
 * @example
 * ```typescript
 * // Basic usage
 * const [model, actions] = useActions<Model, typeof Actions>(model);
 *
 * // Without a model (actions-only)
 * const [, actions] = useActions<void, typeof Actions>();
 *
 * // With reactive data &mdash; consumed in JSX and handlers alike.
 * const [model, actions, data] = useActions<
 *   Model,
 *   typeof Actions,
 *   { query: string }
 * >(initialModel, () => ({ query: props.query }));
 * ```
 */
export function useActions<
  _M extends void = void,
  A extends Actions | void = void,
  D extends Props = Props,
>(getData?: Data<D>): UseActions<void, A, D>;
export function useActions<
  M extends Model,
  A extends Actions | void = void,
  D extends Props = Props,
>(initialModel: M, getData?: Data<D>): UseActions<M, A, D>;
export function useActions<
  M extends Model | void,
  A extends Actions | void,
  D extends Props = Props,
>(...args: unknown[]): unknown {
  const isVoidModel = G.isUndefined(args[0]) || G.isFunction(args[0]);
  const initialModel = <Model>(isVoidModel ? {} : args[0]);
  const getData: Data<D> = G.isFunction(args[0])
    ? <Data<D>>args[0]
    : <Data<D>>(args[1] ?? (() => <D>{}));

  const broadcast = useBroadcast();
  const scope = useScope();
  const tasks = useTasks();
  const store = useStore();
  const slot = useStoreRef();
  const sharing = useSharing();
  const rerender = useRerender();
  const initialised = React.useRef(false);
  const hydration = React.useRef<Process | null>(null);
  const state = React.useRef(new State<Model>());

  if (!initialised.current) {
    initialised.current = true;
    hydration.current = state.current.hydrate(initialModel);
  }
  const [model, setModel] = React.useState<M>(
    () => <M>(<unknown>state.current.model),
  );
  const data = useData(getData());
  const unicast = React.useMemo(() => new EventEmitter(), []);
  const registry = React.useRef<Scope<M, A, D>>({ handlers: new Map() });
  registry.current.handlers = new Map();
  const dispatchers = useDispatchers();
  const phase = React.useRef<Phase>(Phase.Mounting);
  const localTasks = React.useRef<Set<Task>>(new Set());
  const unmountGeneration = React.useRef(0);

  /**
   * Creates the context object passed to action handlers during dispatch.
   *
   * @param action The action symbol being dispatched.
   * @param payload The payload passed with the action.
   * @param result Container for tracking Immertation processes created during execution.
   * @returns A fully-typed Context object for the action handler.
   */
  const getContext = React.useCallback(
    (action: ActionId, payload: unknown, result: Result) => {
      const controller = new AbortController();
      const task: Task = { controller, action, payload };
      tasks.add(task);
      localTasks.current.add(task);

      return <HandlerContext<M, A, D>>(<unknown>{
        model: state.current.model,
        get phase() {
          return phase.current;
        },
        task,
        data,
        tasks,
        store,
        actions: {
          produce(
            f: (draft: {
              model: M;
              readonly inspect: Readonly<Inspect<M>>;
              store: Store;
            }) => void,
          ) {
            if (controller.signal.aborted) return;
            const slotBefore = slot.current;
            const process = state.current.produce((draft) => {
              slot.current = produceImmer(slot.current, (storeDraft) => {
                f({
                  model: <M>(<unknown>draft),
                  inspect: <Readonly<Inspect<M>>>(
                    (<unknown>state.current.inspect)
                  ),
                  store: <Store>storeDraft,
                });
              });
            });
            setModel(<M>(<unknown>state.current.model));
            if (slot.current !== slotBefore) {
              broadcast.emit(StoreSymbol, slot.current);
            }
            result.processes.add(process);
            if (hydration.current) {
              result.processes.add(hydration.current);
              hydration.current = null;
            }
          },
          dispatch(
            action: ActionOrChanneled,
            payload?: HandlerPayload,
          ): Promise<void> {
            if (controller.signal.aborted) return Promise.resolve();
            const base = getActionSymbol(action);
            const channel = isChanneledAction(action)
              ? action.channel
              : undefined;

            if (isMulticastAction(action)) {
              const scoped = getScope(scope, base);
              if (scoped)
                return emitAsync(scoped.emitter, base, payload, channel);
              return Promise.resolve();
            }

            const emitter = isBroadcastAction(action) ? broadcast : unicast;
            return emitAsync(emitter, base, payload, channel);
          },
          annotate<T>(value: T, operation: Operation = Operation.Update): T {
            return state.current.annotate(operation, value);
          },
          get inspect() {
            return state.current.inspect;
          },
          resource: Object.assign(
            function resourceCall<T>(_value: T | null) {
              const call = consumePending();
              const dispatchFromResource = (
                action: unknown,
                payload?: unknown,
              ): Promise<void> => {
                if (controller.signal.aborted) return Promise.resolve();
                const a = <AnyAction>action;
                const base = getActionSymbol(a);
                if (isMulticastAction(a)) {
                  const scoped = getScope(scope, base);
                  if (scoped)
                    return emitAsync(scoped.emitter, base, payload, undefined);
                  return Promise.resolve();
                }
                if (isBroadcastAction(a)) {
                  return emitAsync(broadcast, base, payload, undefined);
                }
                return Promise.resolve();
              };
              const options: {
                exceedsWindow: Temporal.DurationLike | null;
                coalesceToken: Coalesce | undefined;
              } = { exceedsWindow: null, coalesceToken: undefined };
              const fetch = (): Promise<T> => {
                if (G.isNotNullable(options.exceedsWindow)) {
                  const { data, at } = call.read(call.params);
                  if (data !== unset && G.isNotNullable(at)) {
                    const elapsed = Temporal.Now.instant().since(at);
                    const window = Temporal.Duration.from(
                      options.exceedsWindow,
                    );
                    if (Temporal.Duration.compare(elapsed, window) <= 0) {
                      return Promise.resolve(<T>data);
                    }
                  }
                }
                if (G.isUndefined(options.coalesceToken)) {
                  return <Promise<T>>(
                    call.run(
                      slot.current,
                      controller,
                      call.params,
                      dispatchFromResource,
                    )
                  );
                }
                let mutable = sharing.get(call.run);
                if (G.isUndefined(mutable)) {
                  mutable = new Map<string, Promise<unknown>>();
                  sharing.set(call.run, mutable);
                }
                const bucket = mutable;
                const key = `${JSON.stringify(call.params)}|${coalesceKey(options.coalesceToken)}`;
                const existing = <Promise<T> | undefined>bucket.get(key);
                if (existing) return withAbort(existing, controller.signal);
                const detached = new AbortController();
                const shared = (<Promise<T>>(
                  call.run(
                    slot.current,
                    detached,
                    call.params,
                    dispatchFromResource,
                  )
                )).finally(() => {
                  bucket.delete(key);
                });
                bucket.set(key, shared);
                return withAbort(shared, controller.signal);
              };
              const handle = {
                then<U = T, V = never>(
                  onFulfilled?:
                    | ((value: T) => U | PromiseLike<U>)
                    | null
                    | undefined,
                  onRejected?:
                    | ((reason: unknown) => V | PromiseLike<V>)
                    | null
                    | undefined,
                ): Promise<U | V> {
                  return fetch().then(onFulfilled, onRejected);
                },
                exceeds(duration: Temporal.DurationLike) {
                  options.exceedsWindow = duration;
                  return handle;
                },
                coalesce(token?: Coalesce) {
                  options.coalesceToken = token ?? config.defaultToken;
                  return handle;
                },
              };
              return handle;
            },
            {
              set: <T>(_value: T | null, data: T): void => {
                const call = consumePending();
                call.seed(call.params, data, Temporal.Now.instant());
              },
            },
          ),
          async final(action: AnyAction) {
            if (controller.signal.aborted) return null;
            const key = getActionSymbol(action);
            const emitter = isMulticastAction(action)
              ? (getScope(scope, key)?.emitter ?? null)
              : broadcast;
            if (!emitter) return null;
            const cached = emitter.getCached(key);
            if (G.isUndefined(cached)) return null;
            const inspector = state.current.inspect;
            if (inspector.pending()) {
              await new Promise<void>((resolve, reject) => {
                if (controller.signal.aborted)
                  return void reject(controller.signal.reason);
                const onAbort = () => reject(controller.signal.reason);
                controller.signal.addEventListener("abort", onAbort, {
                  once: true,
                });
                inspector.settled().then(() => {
                  controller.signal.removeEventListener("abort", onAbort);
                  resolve();
                });
              });
            }
            return emitter.getCached(key) ?? null;
          },
          peek(action: AnyAction) {
            if (controller.signal.aborted) return null;
            const key = getActionSymbol(action);
            const emitter = isMulticastAction(action)
              ? (getScope(scope, key)?.emitter ?? null)
              : broadcast;
            if (!emitter) return null;
            return emitter.getCached(key) ?? null;
          },
        },
      });
    },
    [model],
  );

  React.useLayoutEffect(() => {
    unmountGeneration.current++;

    function createHandler(
      action: ActionId,
      actionHandler: Handler<M, A, D>,
      getChannel: () => Filter | undefined,
    ) {
      return function handler(
        payload: HandlerPayload,
        dispatchChannel?: Filter | typeof replay,
      ) {
        const registeredChannel = getChannel();

        // Skip channeled handlers during replay — they require specific
        // channel context and cannot process a replay without it.
        if (dispatchChannel === replay && G.isNotNullable(registeredChannel))
          return;

        if (
          G.isNotNullable(dispatchChannel) &&
          dispatchChannel !== replay &&
          G.isNotNullable(registeredChannel)
        ) {
          if (!matchesChannel(dispatchChannel, registeredChannel)) return;
        }

        const result = <Result>{ processes: new Set<Process>() };
        const completion = Promise.withResolvers<void>();
        const context = getContext(action, payload, result);

        function onError(caught: unknown) {
          const errorAction = findLifecycleAction(
            registry.current.handlers,
            "Error",
          );
          const handled = G.isNotNullable(errorAction);
          const details = {
            reason: getReason(caught),
            error: getError(caught),
            action: getName(action),
            handled,
            tasks,
          };
          broadcast.fire(FaultSymbol, details);
          if (handled && errorAction) unicast.emit(errorAction, details);
        }

        function onSettled() {
          for (const task of tasks) {
            if (task === context.task) {
              tasks.delete(task);
              localTasks.current.delete(task);
              break;
            }
          }
          result.processes.forEach((process) => state.current.prune(process));
          if (result.processes.size > 0) rerender();
          completion.resolve();
        }

        let returnValue: ReturnType<Handler<M, A, D>>;
        try {
          returnValue = actionHandler(context, payload);
        } catch (caught) {
          onError(caught);
          onSettled();
          return;
        }

        if (isGenerator(returnValue)) {
          // Generator handlers run in the background and do not block dispatch.
          (async () => {
            for await (const _ of returnValue) void 0;
          })()
            .catch(onError)
            .finally(onSettled);
          return;
        }

        // Regular (sync/async) handlers block dispatch until completion.
        Promise.resolve(returnValue).catch(onError).finally(onSettled);
        return completion.promise;
      };
    }

    const cleanups = new Set<() => void>();

    registry.current.handlers.forEach((entries, action) => {
      for (const { getChannel, handler: actionHandler } of entries) {
        const handler = createHandler(action, actionHandler, getChannel);

        if (isMulticastAction(action)) {
          if (scope) {
            for (const scoped of scope.values()) {
              const emitter = scoped.emitter;
              emitter.on(action, handler);
              cleanups.add(() => emitter.off(action, handler));
            }
          }
          unicast.on(action, handler);
          dispatchers.multicast.add(action);
          cleanups.add(() => unicast.off(action, handler));
        } else if (isBroadcastAction(action)) {
          broadcast.on(action, handler);
          unicast.on(action, handler);
          dispatchers.broadcast.add(action);
          cleanups.add(() => {
            broadcast.off(action, handler);
            unicast.off(action, handler);
          });
        } else {
          unicast.on(action, handler);
          cleanups.add(() => unicast.off(action, handler));
        }
      }
    });

    return () => {
      const generation = ++unmountGeneration.current;
      const pendingCleanups = new Set(cleanups);

      queueMicrotask(() => {
        if (unmountGeneration.current !== generation) {
          for (const cleanup of pendingCleanups) cleanup();
          return;
        }

        for (const task of localTasks.current) {
          task.controller.abort();
          tasks.delete(task);
        }
        localTasks.current.clear();

        phase.current = Phase.Unmounting;
        const unmountAction = findLifecycleAction(
          registry.current.handlers,
          "Unmount",
        );
        if (unmountAction) unicast.emit(unmountAction);
        phase.current = Phase.Unmounted;

        for (const cleanup of pendingCleanups) cleanup();
      });
    };
  }, [unicast]);

  useLifecycles({
    unicast,
    broadcast,
    tasks,
    dispatchers,
    scope,
    phase,
    data: getData(),
    handlers: registry.current.handlers,
  });

  const actionsApi = React.useMemo(
    () => ({
      dispatch(
        action: ActionOrChanneled,
        payload?: HandlerPayload,
      ): Promise<void> {
        const base = getActionSymbol(action);
        const channel = isChanneledAction(action) ? action.channel : undefined;

        if (isMulticastAction(action)) {
          const scoped = getScope(scope, base);
          if (scoped) return emitAsync(scoped.emitter, base, payload, channel);
          return Promise.resolve();
        }

        const emitter = isBroadcastAction(action) ? broadcast : unicast;
        return emitAsync(emitter, base, payload, channel);
      },
      get inspect() {
        return state.current.inspect;
      },
      stream(
        action: AnyAction,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        renderer: ConsumerRenderer<any>,
      ): React.ReactNode {
        return React.createElement(Partition, {
          action: <symbol>getActionSymbol(action),
          renderer,
        });
      },
    }),
    [model, unicast],
  );

  const result = React.useMemo(
    () => <UseActions<M, A, D>>(<unknown>[model, actionsApi, data]),
    [model, actionsApi, data],
  );

  // The public `useAction` signature constrains the action argument to
  // `Subscribable<AC>` (leaf actions on `AC` plus `Lifecycle.Fault`) split
  // into no-payload / with-payload overloads. The runtime is AC-agnostic,
  // so the impl is typed against the loose `ActionOrChanneled` union and
  // cast back to the strict public type.
  const useActionImpl = (
    action: ActionId | HandlerPayload | ChanneledAction,
    handler: Handler<M, A, D>,
  ): void => {
    useRegisterHandler<M, A, D>(registry, action, handler);
  };
  (<UseActions<M, A, D>>result).useAction = <UseActions<M, A, D>["useAction"]>(
    (<unknown>useActionImpl)
  );
  (<UseActions<M, A, D>>result).dispatch = <UseActions<M, A, D>["dispatch"]>(
    (<unknown>result[1].dispatch)
  );

  return <UseActions<M, A, D>>result;
}

type DispatchTarget = (action: unknown, payload?: unknown) => Promise<void>;

/**
 * Returns a stable, typed controller handle up-front &mdash; before a
 * model is declared via `context.useActions(...)`. Use this when an
 * external imperative library (form, animation, third-party SDK) needs a
 * dispatch callback at construction time, while the value that library
 * returns must flow back into the controller's data callback.
 *
 * The handle exposes `dispatch(action, payload?)` and a `useView(...)`
 * method that materialises the component-local model and reactive data
 * &mdash; the M and D pair of `useContext<M, AC, D>` &mdash; and
 * returns the `[model, actions, data]` tuple with `useAction`, `dispatch`,
 * `inspect`, and `stream` attached. The first invocation of
 * `context.actions.dispatch(...)` must come from an event handler &mdash; not
 * synchronously during render &mdash; because the underlying dispatch
 * target is wired up when `context.useActions(...)` runs in the same
 * render pass.
 *
 * @template M The model type representing the component's state.
 * @template AC The actions class containing action definitions.
 * @template D The data type for reactive external values.
 *
 * @example
 * ```ts
 * const context = useContext<Model, typeof Actions, Data>();
 *
 * const form = useForm({
 *   onSubmit: () => void context.actions.dispatch(Actions.Submit),
 * });
 *
 * const actions = context.useActions(
 *   { user: user() },
 *   () => ({ form }),
 * );
 * ```
 */
export function useContext<
  M extends Model | void = void,
  AC extends Actions | void = void,
  D extends Props = Props,
>(): ContextHandle<M, AC, D> {
  const ref = React.useRef<DispatchTarget | null>(null);

  return React.useMemo(() => {
    function dispatch(action: unknown, payload?: unknown): Promise<void> {
      const target = ref.current;
      if (!target) {
        throw new Error(
          "march-hare: useContext handle dispatched before its paired " +
            "context.useActions(...) ran. Call context.actions.dispatch from " +
            "event handlers, not synchronously during render.",
        );
      }
      return target(action, payload);
    }

    function useActionsMethod(...args: unknown[]): unknown {
      const invoke = <(...passed: unknown[]) => UseActions<M, AC, D>>(
        (<unknown>useActions)
      );
      const result = invoke(...args);
      ref.current = <DispatchTarget>(<unknown>result.dispatch);
      return result;
    }

    return <ContextHandle<M, AC, D>>(<unknown>{
      actions: { dispatch },
      useActions: useActionsMethod,
    });
  }, []);
}
