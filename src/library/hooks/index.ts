import * as React from "react";
import {
  useLifecycles,
  useData,
  useNodes,
  isChanneledAction,
  getActionSymbol,
  matchesChannel,
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
} from "../types/index.ts";

import {
  Partition,
  ConsumerRenderer,
} from "../boundary/components/consumer/index.tsx";
import { getReason, getError } from "../error/utils.ts";
import EventEmitter from "eventemitter3";
import { useBroadcast } from "../boundary/components/broadcast/index.tsx";
import {
  useScope,
  getScope,
  MulticastPartition,
} from "../boundary/components/scope/index.tsx";
import {
  isBroadcastAction,
  isMulticastAction,
  getName,
} from "../action/index.ts";
import { useError } from "../error/index.tsx";
import { State, Operation, Process } from "immertation";
import { useTasks } from "../boundary/components/tasks/utils.ts";
import { G } from "@mobily/ts-belt";

function useRegisterHandler<
  M extends Model,
  AC extends Actions,
  D extends Props,
>(
  scope: React.RefObject<Scope>,
  action: ActionId | HandlerPayload | ChanneledAction,
  handler: (
    context: HandlerContext<M, AC, D>,
    payload: unknown,
  ) => void | Promise<void> | AsyncGenerator | Generator,
): void {
  const stableHandler = React.useEffectEvent(
    async (context: HandlerContext<M, AC, D>, payload: unknown) => {
      const isGenerator =
        handler.constructor.name === "GeneratorFunction" ||
        handler.constructor.name === "AsyncGeneratorFunction";

      if (isGenerator) {
        const generator = <Generator | AsyncGenerator>handler(context, payload);
        for await (const _ of generator) void 0;
      } else {
        await handler(context, payload);
      }
    },
  );

  const getChannel = React.useEffectEvent((): Filter | undefined =>
    isChanneledAction(action) ? <Filter>action.channel : undefined,
  );

  const base = getActionSymbol(action);
  const entries = scope.current.handlers.get(base) ?? new Set();
  if (entries.size === 0) scope.current.handlers.set(base, entries);
  entries.add({ getChannel, handler: <Handler>stableHandler });
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
 * 2. An actions object with `dispatch`, `consume`, `inspect`, and `useAction`
 *
 * The `inspect` property provides access to Immertation's annotation system,
 * allowing you to check for pending operations on model properties.
 *
 * @template M The model type representing the component's state.
 * @template AC The actions class containing action definitions.
 * @template S The data type for reactive external values.
 * @param initialModel The initial model state.
 * @param ƒ Optional function that returns reactive values as data.
 *   Values returned are accessible via `context.data` in action handlers,
 *   always reflecting the latest values even after await operations.
 * @returns A result `[model, actions]` with pre-typed `useAction` method.
 *
 * @example
 * ```typescript
 * // types.ts
 * type Model = { visitor: Country | null };
 *
 * export class Actions {
 *   static Visitor = Action<Country>("Visitor");
 * }
 *
 * // actions.ts
 * export function useVisitorActions() {
 *   const actions = useActions<Model, typeof Actions>(model);
 *
 *   actions.useAction(Lifecycle.Mount, (context) => {
 *     // Setup logic - types are pre-baked from useActions
 *   });
 *
 *   actions.useAction(Actions.Visitor, (context, country) => {
 *     context.actions.produce((draft) => {
 *       draft.model.visitor = country;
 *     });
 *   });
 *
 *   actions.useAction(Lifecycle.Unmount, (context) => {
 *     // Cleanup logic
 *   });
 *
 *   return actions;
 * }
 *
 * // With data for reactive external values
 * function useSearchActions(props: { query: string }) {
 *   const actions = useActions<Model, typeof Actions, { query: string }>(
 *     model,
 *     () => ({ query: props.query })
 *   );
 *
 *   actions.useAction(Actions.Search, async (context) => {
 *     await fetch("/search");
 *     // context.data.query is always the latest value
 *     console.log(context.data.query);
 *   });
 *
 *   return actions;
 * }
 *
 * // Component usage
 * function Visitor() {
 *   const [model, actions] = useVisitorActions();
 *   return <div>{model.visitor?.name}</div>;
 * }
 * ```
 */
export function useActions<
  M extends Model,
  AC extends Actions,
  D extends Props = Props,
>(initialModel: M, getData: Data<D> = () => <D>{}): UseActions<M, AC, D> {
  const broadcast = useBroadcast();
  const scopeContext = useScope();
  const error = useError();
  const tasks = useTasks();
  const [model, setModel] = React.useState<M>(initialModel);
  const rerender = useRerender();
  const hydration = React.useRef<Process | null>(null);
  const state = React.useRef<State<M>>(
    (() => {
      const state = new State<M>();
      hydration.current = state.hydrate(initialModel);
      return state;
    })(),
  );
  const data = useData(getData());
  const unicast = React.useMemo(() => new EventEmitter(), []);
  const scope = React.useRef<Scope>({ handlers: new Map() });
  const broadcastActions = React.useRef<Set<ActionId>>(new Set());
  const multicastActions = React.useRef<Set<ActionId>>(new Set());
  const phase = React.useRef<Phase>(Phase.Mounting);
  const nodes = useNodes<M>();

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

      return <HandlerContext<M, AC, D>>{
        model,
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
              f({ model: draft, inspect: state.current.inspect }),
            );
            setModel(state.current.model);
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

            // Handle multicast - dispatch to named scope
            if (isMulticastAction(action)) {
              if (!options?.scope) {
                console.warn(
                  `Multicast action dispatched without scope. Use: dispatch(action, payload, { scope: "ScopeName" })`,
                );
                return;
              }
              const scopeEntry = getScope(scopeContext, options.scope);
              if (!scopeEntry) {
                // No matching scope found - silently ignore per spec
                return;
              }
              scopeEntry.emitter.emit(base, payload, channel);
              return;
            }

            const emitter = isBroadcastAction(action) ? broadcast : unicast;
            emitter.emit(base, payload, channel);
          },
          annotate<T>(operation: Operation, value: T): T {
            return state.current.annotate(operation, value);
          },
        },
      };
    },
    [model],
  );

  React.useLayoutEffect(() => {
    function createHandler(
      action: ActionId,
      actionHandler: Handler,
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
          const handled = scope.current.handlers.has(Lifecycle.Error);
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
              break;
            }
          }
          result.processes.forEach((process) => state.current.prune(process));
          // Only rerender if state was actually changed (produce was called)
          if (result.processes.size > 0) rerender();
          completion.resolve();
        }
      };
    }

    const cleanupFns: Array<() => void> = [];

    scope.current.handlers.forEach((entries, action) => {
      for (const { getChannel, handler: actionHandler } of entries) {
        const handler = createHandler(action, actionHandler, getChannel);

        if (isMulticastAction(action)) {
          // Subscribe to ALL ancestor scopes for multicast actions
          // This allows handlers to receive events from any matching scope
          if (scopeContext) {
            for (const scopeEntry of scopeContext.values()) {
              const emitter = scopeEntry.emitter;
              emitter.on(action, handler);
              cleanupFns.push(() => emitter.off(action, handler));
            }
          }
          // Also listen on unicast for local dispatches
          unicast.on(action, handler);
          multicastActions.current.add(action);
          cleanupFns.push(() => unicast.off(action, handler));
        } else if (isBroadcastAction(action)) {
          broadcast.on(action, handler);
          unicast.on(action, handler);
          broadcastActions.current.add(action);
          cleanupFns.push(() => {
            broadcast.off(action, handler);
            unicast.off(action, handler);
          });
        } else {
          unicast.on(action, handler);
          cleanupFns.push(() => unicast.off(action, handler));
        }
      }
    });

    return () => {
      // Emit Unmount before removing handlers so they can respond (e.g., abort tasks)
      phase.current = Phase.Unmounting;
      unicast.emit(Lifecycle.Unmount);
      phase.current = Phase.Unmounted;
      for (const cleanup of cleanupFns) cleanup();
    };
  }, [unicast]);

  // Process pending node captures after each render
  // Only emit if the node truly changed (not just React's ref cleanup/setup cycle)
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
    tasks,
    broadcastActions: broadcastActions.current,
    phase,
    data: getData(),
  });

  const result = React.useMemo(
    () =>
      <UseActions<M, AC, D>>[
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

            // Handle multicast - dispatch to named scope
            if (isMulticastAction(action)) {
              if (!options?.scope) {
                console.warn(
                  `Multicast action dispatched without scope. Use: dispatch(action, payload, { scope: "ScopeName" })`,
                );
                return;
              }
              const scopeEntry = getScope(scopeContext, options.scope);
              if (!scopeEntry) {
                // No matching scope found - silently ignore per spec
                return;
              }
              scopeEntry.emitter.emit(base, payload, channel);
              return;
            }

            const emitter = isBroadcastAction(action) ? broadcast : unicast;
            emitter.emit(base, payload, channel);
          },
          consume(
            action: symbol | object,
            renderer: ConsumerRenderer<unknown>,
            options?: MulticastOptions,
          ): React.ReactNode {
            // Handle multicast consume
            if (isMulticastAction(action)) {
              if (!options?.scope) {
                console.warn(
                  `Multicast action consumed without scope. Use: consume(action, renderer, { scope: "ScopeName" })`,
                );
                return null;
              }
              return React.createElement(MulticastPartition, {
                action: <symbol>getActionSymbol(action),
                scopeName: options.scope,
                renderer,
              });
            }

            return React.createElement(Partition, {
              action: <symbol>getActionSymbol(action),
              renderer,
            });
          },
          get inspect() {
            return state.current.inspect;
          },
          get nodes() {
            return nodes.refs.current;
          },
          node<K extends keyof Nodes<M>>(name: K, value: Nodes<M>[K] | null) {
            nodes.refs.current[name] = value;
            // Always queue - processed in useLayoutEffect after render completes
            // This handles React's ref cleanup/setup cycle correctly
            nodes.pending.current.set(name, value);
          },
        },
      ],
    [model, unicast],
  );

  (<UseActions<M, AC, D>>result).useAction = <
    A extends ActionId | HandlerPayload | ChanneledAction,
  >(
    action: A,
    handler: (
      context: HandlerContext<M, AC, D>,
      payload: Payload<A>,
    ) => void | Promise<void> | AsyncGenerator | Generator,
  ): void => {
    useRegisterHandler<M, AC, D>(scope, action, <Handler<M, AC, D>>handler);
  };

  return <UseActions<M, AC, D>>result;
}
