import * as React from "react";
import {
  useLifecycles,
  useData,
  isChanneledAction,
  getActionSymbol,
  matchesChannel,
  useRegisterHandler,
  useReactiveEmit,
  useDispatchers,
  findLifecycleAction,
  isGenerator,
  emitAsync,
} from "./utils.ts";
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
  CurrentTask,
  Filter,
  ChanneledAction,
  ActionOrChanneled,
  AnyAction,
  FaultSymbol,
  EnvSymbol,
} from "../types/index.ts";

import { getReason, getError } from "../error/utils.ts";
import { Aborted } from "../error/index.ts";
import EventEmitter from "eventemitter3";
import { useBroadcast } from "../boundary/components/broadcast/index.tsx";
import { useScope, getScope } from "../boundary/components/scope/index.tsx";
import { useEnv, useEnvRef } from "../boundary/components/env/utils.ts";
import type { Env } from "../boundary/components/env/types.ts";
import { produce as produceImmer } from "immer";
import { nuke } from "../resource/index.ts";
import type { Invocation, LocalInvocation } from "../resource/types.ts";
import type {
  LocalResourceCall,
  ResourceCall,
  ResourceDispatcher,
} from "../types/index.ts";
import { withAbort } from "../coalesce/index.ts";
import type { Share } from "../boundary/components/sharing/index.tsx";
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
import { useTap } from "../boundary/components/tap/utils.ts";

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
 * @param model The initial model state.
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
 * >(model, () => ({ query: props.query }));
 * ```
 */
export function useActions<
  M extends void = void,
  A extends Actions | void = void,
  D extends Props = Props,
>(getData?: Data<D>): UseActions<M, A, D>;
export function useActions<
  M extends Model,
  A extends Actions | void = void,
  D extends Props = Props,
>(model: M, getData?: Data<D>): UseActions<M, A, D>;
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
  const env = useEnv();
  const slot = useEnvRef();
  const sharing = useSharing();
  const tap = useTap();
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
      const task: CurrentTask = {
        controller,
        action,
        payload,
        supersede() {
          for (const sibling of tasks) {
            if (sibling !== task && sibling.action === action) {
              sibling.controller.abort(new Aborted("Superseded"));
            }
          }
        },
      };
      tasks.add(task);
      localTasks.current.add(task);

      return <HandlerContext<M, A, D>>(<unknown>{
        get model() {
          return state.current.model;
        },
        get phase() {
          return phase.current;
        },
        task,
        data,
        tasks,
        env,
        actions: {
          produce(
            f: (draft: {
              model: M;
              readonly inspect: Readonly<Inspect<M>>;
              env: Env;
            }) => void,
          ) {
            if (controller.signal.aborted) return;
            const slotBefore = slot.current;
            const process = state.current.produce((draft) => {
              slot.current = produceImmer(slot.current, (envDraft) => {
                f({
                  model: <M>(<unknown>draft),
                  inspect: <Readonly<Inspect<M>>>(
                    (<unknown>state.current.inspect)
                  ),
                  env: <Env>envDraft,
                });
              });
            });
            setModel(<M>(<unknown>state.current.model));
            if (slot.current !== slotBefore) {
              broadcast.emit(EnvSymbol, slot.current);
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
              const scoped = getScope(scope);
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
          resource: (() => {
            const dispatchFromResource = (
              action: unknown,
              payload?: unknown,
            ): Promise<void> => {
              const a = <AnyAction>action;
              const base = getActionSymbol(a);
              const channel = isChanneledAction(a) ? a.channel : undefined;
              if (isMulticastAction(a)) {
                const scoped = getScope(scope);
                if (scoped)
                  return emitAsync(scoped.emitter, base, payload, channel);
                return Promise.resolve();
              }
              if (isBroadcastAction(a)) {
                return emitAsync(broadcast, base, payload, channel);
              }
              return Promise.resolve();
            };
            function resourceCall<T, P extends object>(
              call: LocalInvocation<T, P>,
            ): LocalResourceCall<T>;
            function resourceCall<T, P extends object>(
              call: Invocation<T, P>,
            ): ResourceCall<T>;
            function resourceCall<T, P extends object>(
              call: Invocation<T, P> | LocalInvocation<T, P>,
            ): LocalResourceCall<T> | ResourceCall<T> {
              if ("write" in call) {
                return {
                  set(value: T): void {
                    call.write(env, call.params, value, dispatchFromResource);
                  },
                  evict(where?: Record<string, unknown>): void {
                    call.evict(where ?? call.params, dispatchFromResource);
                  },
                };
              }
              const options: {
                exceedsWindow: Temporal.DurationLike | null;
                isolated: boolean;
              } = { exceedsWindow: null, isolated: false };
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
                if (options.isolated) {
                  return <Promise<T>>(
                    call.run(env, controller, call.params, dispatchFromResource)
                  );
                }
                let mutable = sharing.get(call.run);
                if (G.isUndefined(mutable)) {
                  mutable = new Map<string, Share>();
                  sharing.set(call.run, mutable);
                }
                const bucket = mutable;
                const slot = JSON.stringify(call.params);
                let share = <Share<T> | undefined>bucket.get(slot);
                if (G.isUndefined(share)) {
                  const detached = new AbortController();
                  const created: Share<T> = <Share<T>>{
                    controller: detached,
                    refs: 0,
                  };
                  created.promise = (<Promise<T>>(
                    call.run(env, detached, call.params, dispatchFromResource)
                  )).finally(() => {
                    bucket.delete(slot);
                  });
                  bucket.set(slot, <Share>(<unknown>created));
                  share = created;
                }
                const joined = share;
                joined.refs += 1;
                const release = (): void => {
                  joined.refs -= 1;
                  if (joined.refs === 0) {
                    bucket.delete(slot);
                    joined.controller.abort(controller.signal.reason);
                  }
                };
                if (controller.signal.aborted) {
                  release();
                } else {
                  controller.signal.addEventListener("abort", release, {
                    once: true,
                  });
                  const cleanup = (): void =>
                    controller.signal.removeEventListener("abort", release);
                  joined.promise.then(cleanup, cleanup);
                }
                return withAbort(joined.promise, controller.signal);
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
                isolated() {
                  options.isolated = true;
                  return handle;
                },
                evict(where?: object): void {
                  call.evict(where ?? call.params, dispatchFromResource);
                },
              };
              return handle;
            }
            return <ResourceDispatcher>Object.defineProperty(
              resourceCall,
              "nuke",
              {
                value: (where?: object): void =>
                  nuke(where, dispatchFromResource),
                enumerable: false,
              },
            );
          })(),
          async final(action: AnyAction) {
            if (controller.signal.aborted) return null;
            const key = getActionSymbol(action);
            const emitter = isMulticastAction(action)
              ? (getScope(scope)?.emitter ?? null)
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
                void inspector.settled().then(() => {
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
              ? (getScope(scope)?.emitter ?? null)
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
        dispatchChannel?: Filter,
      ) {
        const registeredChannel = getChannel();

        if (
          G.isNotNullable(dispatchChannel) &&
          G.isNotNullable(registeredChannel)
        ) {
          if (!matchesChannel(dispatchChannel, registeredChannel)) return;
        }

        const result = <Result>{ processes: new Set<Process>() };
        const completion = Promise.withResolvers<void>();
        const context = getContext(action, payload, result);
        const actionName = getName(action);
        const startedAt = performance.now();
        const modelBefore = <unknown>state.current.model;
        const envBefore = <unknown>slot.current;
        let errored = false;

        function mutations() {
          const modelAfter = <unknown>state.current.model;
          const envAfter = <unknown>slot.current;
          return {
            model:
              modelBefore === modelAfter
                ? null
                : { before: modelBefore, after: modelAfter },
            env:
              envBefore === envAfter
                ? null
                : { before: envBefore, after: envAfter },
          };
        }

        tap({
          stage: "start",
          action: { name: actionName, payload },
          details: { task: context.task },
        });

        function retry(): Promise<void> {
          if (isMulticastAction(action)) {
            const scoped = getScope(scope);
            if (!scoped) return Promise.resolve();
            return emitAsync(scoped.emitter, action, payload, dispatchChannel);
          }
          const emitter = isBroadcastAction(action) ? broadcast : unicast;
          return emitAsync(emitter, action, payload, dispatchChannel);
        }

        function onError(caught: unknown) {
          errored = true;
          const errorAction = findLifecycleAction(
            registry.current.handlers,
            "Error",
          );
          const handled = G.isNotNullable(errorAction);
          const reason = getReason(caught);
          const error = getError(caught);
          const details = {
            reason,
            error,
            action: actionName,
            handled,
            tasks,
            retry,
          };
          broadcast.fire(FaultSymbol, details);
          if (handled && errorAction) unicast.emit(errorAction, details);
          tap({
            stage: "end",
            result: "error",
            action: { name: actionName, payload },
            details: {
              task: context.task,
              elapsed: performance.now() - startedAt,
              mutations: mutations(),
              error,
              reason,
            },
          });
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
          if (!errored) {
            tap({
              stage: "end",
              result: "success",
              action: { name: actionName, payload },
              details: {
                task: context.task,
                elapsed: performance.now() - startedAt,
                mutations: mutations(),
              },
            });
          }
          completion.resolve();
        }

        let returnValue: ReturnType<Handler<M, A, D>>;
        try {
          returnValue = actionHandler(context, payload);
        } catch (caught) {
          onError(caught);
          onSettled();
          return completion.promise;
        }

        if (isGenerator(returnValue)) {
          (async () => {
            for await (const _ of returnValue) void 0;
          })()
            .catch(onError)
            .finally(onSettled);
          return completion.promise;
        }

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
            const emitter = scope.emitter;
            emitter.on(action, handler);
            cleanups.add(() => emitter.off(action, handler));
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
          task.controller.abort(new Aborted("Component unmounted"));
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
          const scoped = getScope(scope);
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
  //
  // Each call site owns a stable symbol shared by its registration and its
  // reactive emission, pairing a `Lifecycle.Reactive` binding's dispatch
  // with exactly its own handler via the channel machinery.
  const useActionImpl = (
    action: ActionId | HandlerPayload | ChanneledAction,
    handler: Handler<M, A, D>,
  ): void => {
    const site = React.useRef<symbol | null>(null);
    site.current ??= Symbol("march-hare.reactive/site");
    useRegisterHandler<M, A, D>(registry, action, handler, site.current);
    useReactiveEmit(action, unicast, site.current);
  };
  (<UseActions<M, A, D>>result).useAction = <UseActions<M, A, D>["useAction"]>(
    (<unknown>useActionImpl)
  );
  (<UseActions<M, A, D>>result).dispatch = <UseActions<M, A, D>["dispatch"]>(
    (<unknown>result[1].dispatch)
  );

  return <UseActions<M, A, D>>result;
}
