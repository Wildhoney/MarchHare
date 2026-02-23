import * as React from "react";
import {
  useLifecycles,
  useData,
  useNodes,
  isChanneledAction,
  getActionSymbol,
  matchesChannel,
  useRegisterHandler,
  useDispatchers,
} from "./utils.ts";
export { With } from "./utils.ts";
import { useRerender } from "../utils/utils.ts";
import type { Data, Handler, Scope } from "./types.ts";
import {
  HandlerContext,
  Lifecycle,
  Brand,
  Phase,
  Model,
  HandlerPayload,
  Payload,
  Props,
  Actions,
  ActionId,
  UseActions,
  Result,
  Task,
  Filter,
  ChanneledAction,
  ActionOrChanneled,
  Nodes,
  MulticastOptions,
  AnyAction,
  type CacheId,
} from "../types/index.ts";

import { getReason, getError } from "../error/utils.ts";
import EventEmitter from "eventemitter3";
import { useBroadcast } from "../boundary/components/broadcast/index.tsx";
import { useScope, getScope } from "../boundary/components/scope/index.tsx";
import {
  isBroadcastAction,
  isMulticastAction,
  getName,
} from "../action/index.ts";
import { useError } from "../error/index.tsx";
import { State, Operation, Process, Inspect } from "immertation";
import { useTasks } from "../boundary/components/tasks/utils.ts";
import { useCacheStore } from "../boundary/components/cache/index.tsx";
import { Partition } from "../boundary/components/consumer/index.tsx";
import type { ConsumerRenderer } from "../boundary/components/consumer/types.ts";
import { getCacheKey, unwrap } from "../cache/index.ts";
import { G } from "@mobily/ts-belt";

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
 * @returns A result `[model, actions]` with pre-typed `useAction` method.
 *
 * @example
 * ```typescript
 * // Basic usage
 * const actions = useActions<Model, typeof Actions>(model);
 *
 * // Without a model (actions-only)
 * const actions = useActions<void, typeof Actions>();
 *
 * // With reactive data
 * const actions = useActions<Model, typeof Actions, { query: string }>(
 *   model,
 *   () => ({ query: props.query }),
 * );
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
  const error = useError();
  const tasks = useTasks();
  const cache = useCacheStore();
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
  const nodes = useNodes<M>();
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

      return <HandlerContext<M, A, D>>{
        model: state.current.model,
        get phase() {
          return phase.current;
        },
        task,
        data,
        tasks,
        nodes: nodes.refs.current,
        actions: {
          produce(f) {
            if (controller.signal.aborted) return;
            const process = state.current.produce((draft) =>
              f({
                model: <M>(<unknown>draft),
                inspect: <Readonly<Inspect<M>>>(<unknown>state.current.inspect),
              }),
            );
            setModel(<M>(<unknown>state.current.model));
            result.processes.add(process);
            if (hydration.current) {
              result.processes.add(hydration.current);
              hydration.current = null;
            }
          },
          dispatch(
            action: ActionOrChanneled,
            payload?: HandlerPayload,
            options?: MulticastOptions,
          ) {
            if (controller.signal.aborted) return;
            const base = getActionSymbol(action);
            const channel = isChanneledAction(action)
              ? action.channel
              : undefined;

            if (isMulticastAction(action) && options?.scope) {
              const scoped = getScope(scope, options.scope);
              if (scoped) scoped.emitter.emit(base, payload, channel);
              return;
            }

            const emitter = isBroadcastAction(action) ? broadcast : unicast;
            emitter.emit(base, payload, channel);
          },
          annotate<T>(operation: Operation, value: T): T {
            return state.current.annotate(operation, value);
          },
          async cacheable(entry, ttl, fn) {
            if (controller.signal.aborted) return { data: null };

            const key = getCacheKey(<CacheId>(<unknown>entry));
            const cached = cache.get(key);
            if (cached && Date.now() < cached.expiry) {
              return { data: cached.value };
            }

            const raw = await fn();
            const outcome = unwrap(raw);

            if (!outcome.ok) return { data: null };
            cache.set(key, {
              value: outcome.value,
              expiry: Date.now() + ttl,
            });
            return { data: outcome.value };
          },
          invalidate(entry) {
            cache.delete(getCacheKey(<CacheId>(<unknown>entry)));
          },
          async read(action: AnyAction, options?: MulticastOptions) {
            if (controller.signal.aborted) return null;

            const key = getActionSymbol(action);

            const emitter =
              isMulticastAction(action) && options?.scope
                ? (getScope(scope, options.scope)?.emitter ?? null)
                : broadcast;

            if (!emitter) return null;

            const cached = emitter.getCached(key);
            if (cached === undefined) return null;

            // Derive the model path from the action name and wait for
            // any pending Immertation annotations to settle.
            const actionName = getName(action);
            const path =
              actionName !== "unknown"
                ? actionName[0].toLowerCase() + actionName.slice(1)
                : null;

            if (path) {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const inspector = (<any>state.current.inspect)[path];
              if (inspector?.pending?.()) {
                await new Promise<void>((resolve, reject) => {
                  if (controller.signal.aborted) {
                    reject(controller.signal.reason);
                    return;
                  }
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
            }

            return emitter.getCached(key) ?? null;
          },
          peek(action: AnyAction, options?: MulticastOptions) {
            if (controller.signal.aborted) return null;

            const key = getActionSymbol(action);

            const emitter =
              isMulticastAction(action) && options?.scope
                ? (getScope(scope, options.scope)?.emitter ?? null)
                : broadcast;

            if (!emitter) return null;

            return emitter.getCached(key) ?? null;
          },
        },
      };
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
      return async function handler(
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
        try {
          await actionHandler(context, payload);
        } catch (caught) {
          const handled = registry.current.handlers.has(Lifecycle.Error);
          const details = {
            reason: getReason(caught),
            error: getError(caught),
            action: getName(action),
            handled,
            tasks,
          };
          error?.(details);
          if (handled) unicast.emit(Lifecycle.Error, details);
        } finally {
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
        unicast.emit(Lifecycle.Unmount);
        phase.current = Phase.Unmounted;

        for (const cleanup of pendingCleanups) cleanup();
      });
    };
  }, [unicast]);

  React.useLayoutEffect(() => {
    for (const [name, node] of nodes.pending.current) {
      const latest = nodes.emitted.current.get(name);
      if (latest !== node) {
        nodes.emitted.current.set(name, node);
        unicast.emit(Brand.Node, node, { Name: name });
      }
    }
    nodes.pending.current.clear();
  });

  useLifecycles({
    unicast,
    broadcast,
    tasks,
    dispatchers,
    scope,
    phase,
    data: getData(),
  });

  const result = React.useMemo(
    () =>
      <UseActions<M, A, D>>[
        model,
        {
          dispatch(
            action: ActionOrChanneled,
            payload?: HandlerPayload,
            options?: MulticastOptions,
          ) {
            const base = getActionSymbol(action);
            const channel = isChanneledAction(action)
              ? action.channel
              : undefined;

            if (isMulticastAction(action) && options?.scope) {
              const scoped = getScope(scope, options.scope);
              if (scoped) scoped.emitter.emit(base, payload, channel);
              return;
            }

            const emitter = isBroadcastAction(action) ? broadcast : unicast;
            emitter.emit(base, payload, channel);
          },
          get inspect() {
            return state.current.inspect;
          },
          get nodes() {
            return nodes.refs.current;
          },
          node<K extends keyof Nodes<M>>(name: K, value: Nodes<M>[K] | null) {
            nodes.refs.current[name] = value;
            nodes.pending.current.set(name, value);
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
        },
      ],
    [model, unicast],
  );

  (<UseActions<M, A, D>>result).useAction = <
    Action extends ActionId | HandlerPayload | ChanneledAction,
  >(
    action: Action,
    handler: (
      context: HandlerContext<M, A, D>,
      ...args: [Payload<Action>] extends [never]
        ? []
        : [payload: Payload<Action>]
    ) => void | Promise<void> | AsyncGenerator | Generator,
  ): void => {
    useRegisterHandler<M, A, D>(registry, action, <Handler<M, A, D>>handler);
  };

  return <UseActions<M, A, D>>result;
}
