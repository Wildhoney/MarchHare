import * as React from "react";
import { useLifecycles, useData } from "./utils.ts";
import { useRerender } from "../utils/utils.ts";
import type { Data, Handler, Scope } from "./types.ts";
import {
  ReactiveInterface,
  Lifecycle,
  Model,
  Payload,
  Props,
  Actions,
  ActionId,
  UseActions,
  Result,
  ExtractPayload,
  Task,
} from "../types/index.ts";

import {
  Partition,
  ConsumerRenderer,
} from "../boundary/components/consumer/index.tsx";
import { getReason, normaliseError } from "../utils/index.ts";
import EventEmitter from "eventemitter3";
import { useBroadcast } from "../boundary/components/broadcast/index.tsx";
import { isDistributedAction, getActionName } from "../action/index.ts";
import { useError } from "../error/index.tsx";
import { State, Operation, Process } from "immertation";
import { useTasks } from "../boundary/components/tasks/utils.ts";

function useRegisterHandler<
  M extends Model,
  AC extends Actions,
  D extends Props,
>(
  scope: React.RefObject<Scope>,
  action: ActionId,
  handler: (
    context: ReactiveInterface<M, AC, D>,
    payload: unknown,
  ) => void | Promise<void> | AsyncGenerator | Generator,
): void {
  const stableHandler = React.useEffectEvent(
    async (context: ReactiveInterface<M, AC, D>, payload: unknown) => {
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

  scope.current.handlers.set(action, <Handler>stableHandler);
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

      return <ReactiveInterface<M, AC, D>>{
        model,
        task,
        data,
        tasks,
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
            ...[action, payload]: [action: ActionId, payload?: Payload]
          ) {
            if (controller.signal.aborted) return;
            isDistributedAction(action)
              ? broadcast.emit(action, payload)
              : unicast.emit(action, payload);
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
    function createHandler(action: ActionId, actionHandler: Handler) {
      return async function handler(payload: Payload) {
        const result = <Result>{ processes: new Set<Process>() };
        const completion = Promise.withResolvers<void>();
        const context = getContext(action, payload, result);
        try {
          await actionHandler(context, payload);
        } catch (caught) {
          const hasErrorHandler = scope.current.handlers.has(Lifecycle.Error);
          const details = {
            reason: getReason(caught),
            error: normaliseError(caught),
            action: getActionName(action),
            handled: hasErrorHandler,
          };
          error?.(details);
          if (hasErrorHandler) unicast.emit(Lifecycle.Error, details);
        } finally {
          for (const task of tasks) {
            if (task === context.task) {
              tasks.delete(task);
              break;
            }
          }
          result.processes.forEach((process) => state.current.prune(process));
          rerender();
          completion.resolve();
        }
      };
    }

    scope.current.handlers.forEach((actionHandler, action) => {
      const handler = createHandler(action, actionHandler);

      isDistributedAction(action)
        ? broadcast.on(action, handler)
        : unicast.on(action, handler);
    });
  }, [unicast]);

  useLifecycles({ unicast, tasks });

  const result = React.useMemo(
    () =>
      <UseActions<M, AC, D>>[
        model,
        {
          dispatch(
            ...[action, payload]: [action: ActionId, payload?: Payload]
          ) {
            isDistributedAction(action)
              ? broadcast.emit(action, payload)
              : unicast.emit(action, payload);
          },
          consume(
            action: symbol,
            renderer: ConsumerRenderer<unknown>,
          ): React.ReactNode {
            return React.createElement(Partition, {
              action,
              renderer,
            });
          },
          get inspect() {
            return state.current.inspect;
          },
        },
      ],
    [model, unicast],
  );

  (<UseActions<M, AC, D>>result).useAction = <A extends ActionId>(
    action: A,
    handler: (
      context: ReactiveInterface<M, AC, D>,
      payload: ExtractPayload<A>,
    ) => void | Promise<void> | AsyncGenerator | Generator,
  ): void => {
    useRegisterHandler<M, AC, D>(scope, action, <Handler<M, AC, D>>handler);
  };

  return <UseActions<M, AC, D>>result;
}
