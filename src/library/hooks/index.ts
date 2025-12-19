/* eslint-disable @typescript-eslint/no-unsafe-function-type */
/* eslint-disable @typescript-eslint/no-explicit-any */
import * as React from "react";
import { G } from "@mobily/ts-belt";
import { withGetters } from "./utils.ts";
import {
  Context,
  Lifecycle,
  Model,
  Payload,
  Props,
  ActionsClass,
  Actions,
  Action,
  UseActions,
  Result,
  Status,
} from "../types/index.ts";
import EventEmitter from "eventemitter3";
import { useBroadcast } from "../broadcast/index.tsx";
import { isDistributedAction, getActionName } from "../action/index.ts";
import { useError, Reason } from "../error/index.tsx";
import { State, Operation, Process } from "immertation";
import { context, entries, polls } from "../use/index.ts";
import * as utils from "../utils/index.ts";

/**
 * Determines the error reason based on what was thrown.
 *
 * @param error The value that was thrown.
 * @returns The appropriate Reason enum value.
 */
export function getReason(error: unknown): Reason {
  if (error instanceof Error) {
    if (error.name === "TimeoutError") return Reason.Timeout;
    if (error.name === "AbortError") return Reason.Aborted;
  }
  return Reason.Error;
}

/**
 * Normalises a thrown value into an Error instance.
 *
 * @param error The value that was thrown.
 * @returns An Error instance (original if already Error, wrapped otherwise).
 */
export function normaliseError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

/**
 * Creates a memoized action handler that always has access to the latest closure values.
 *
 * This hook uses React's useEffectEvent to ensure the handler always sees current
 * props and state values, avoiding stale closures while maintaining a stable function identity.
 *
 * @template M The type of the model.
 * @template AC The type of the actions class.
 * @template K The specific action key being handled.
 * @param handler The action handler function that receives context and optional payload.
 * @returns A memoized async function that executes the handler with error handling.
 */
export function useAction<
  M extends Model,
  AC extends ActionsClass<any>,
  K extends Exclude<keyof AC, "prototype"> | never = never,
>(
  handler: (
    context: Context<M, AC>,
    payload: [K] extends [never]
      ? unknown
      : AC[K] extends Payload<infer P>
        ? P
        : unknown,
  ) => void | Promise<void> | AsyncGenerator | Generator,
) {
  return React.useEffectEvent(
    async (
      context: Context<M, AC>,
      payload: [K] extends [never]
        ? unknown
        : AC[K] extends Payload<infer P>
          ? P
          : unknown,
    ) => {
      const isGenerator =
        handler.constructor.name === "GeneratorFunction" ||
        handler.constructor.name === "AsyncGeneratorFunction";

      if (isGenerator) {
        const generator = handler(context, payload) as
          | Generator
          | AsyncGenerator;

        for await (const _ of generator) void 0;
      } else {
        await handler(context, payload);
      }
    },
  );
}

/**
 * A hook for managing state with actions.
 *
 * Pass type parameters explicitly to get proper type inference for the returned tuple:
 * `useActions<Model, typeof Actions>(initialModel, actionClass)`
 *
 * The hook returns a tuple containing:
 * 1. The current model state
 * 2. An actions object with `dispatch` and `inspect` properties
 *
 * The `inspect` property provides access to Immertation's annotation system,
 * allowing you to check for pending operations on model properties using
 * methods like `actions.inspect.count.pending()` and `actions.inspect.count.remaining()`.
 *
 * @template M The type of the model state.
 * @template AC The type of the actions class (should be `typeof YourActionsClass`).
 * @param {M} initialModel The initial model state.
 * @param {Actions<M, AC> | (new () => unknown)} ActionClass The class defining the actions.
 * @returns {UseActions<M, AC>} A tuple `[model, actions]` where `actions` includes `dispatch` and `inspect`.
 *
 * @example
 * ```typescript
 * // In your actions file
 * export default function useCounterActions() {
 *   return useActions<Model, typeof Actions>(
 *     { count: 0 },
 *     class {
 *       [Actions.Increment] = incrementAction;
 *       [Actions.Decrement] = decrementAction;
 *     }
 *   );
 * }
 *
 * // In your component
 * function Counter() {
 *   const [model, actions] = useCounterActions();
 *
 *   return (
 *     <div>
 *       <p>Count: {model.count}</p>
 *       {actions.inspect.count.pending() && <Spinner />}
 *       {actions.inspect.count.pending() && (
 *         <p>Remaining: {actions.inspect.count.remaining()}</p>
 *       )}
 *       <button onClick={() => actions.dispatch(Actions.Increment)}>+</button>
 *     </div>
 *   );
 * }
 * ```
 */
export function useActions<M extends Model, AC extends ActionsClass<any>>(
  initialModel: M,
  ActionClass: Actions<M, AC> | (new () => unknown),
): UseActions<M, AC> {
  const broadcast = useBroadcast();
  const handleError = useError();
  const [model, setModel] = React.useState<M>(initialModel);
  const state = React.useRef<State<M>>(new State<M>(initialModel));
  const snapshot = useSnapshot({ model });
  const unicast = React.useMemo(() => new EventEmitter(), []);
  const instance = React.useRef<object | null>(null);
  const reactives = React.useRef<Map<symbol, string | null>>(new Map());
  const bindings = entries.get(<object>new (<Actions<M, AC>>ActionClass)());
  const pollBindings = polls.get(<object>new (<Actions<M, AC>>ActionClass)());

  const getContext = React.useCallback(
    (result: Result) => {
      const controller = new AbortController();

      return <Context<M, AC>>{
        signal: controller.signal,
        actions: {
          produce(f) {
            if (controller.signal.aborted) return;
            const process = state.current.mutate((draft) =>
              f({ model: draft, inspect: state.current.inspect }),
            );
            setModel(state.current.model);
            result.processes.add(process);
          },
          dispatch(...[action, payload]: [action: any, payload?: any]) {
            if (controller.signal.aborted) return;
            if (isDistributedAction(action)) broadcast.emit(action, payload);
            else unicast.emit(action, payload);
          },
          annotate<T>(operation: Operation, value: T): T {
            return state.current.annotate(operation, value);
          },
        },
        [context]: {
          controller,
        },
      };
    },
    [snapshot.model],
  );

  React.useLayoutEffect(() => {
    const actions = new (<Actions<M, AC>>ActionClass)();
    instance.current = <object>actions;

    Object.getOwnPropertySymbols(actions).forEach((action) => {
      const key = <keyof typeof actions>action;

      async function handler(payload: Payload) {
        const result = <Result>{ processes: new Set<Process>() };
        const task = Promise.withResolvers<void>();
        try {
          await (<Function>actions[key])(getContext(result), payload);
        } catch (error) {
          const handled = Lifecycle.Error in <object>actions;
          const details = {
            reason: getReason(error),
            error: normaliseError(error),
            action: getActionName(action),
            handled,
          };
          handleError?.(details);
          if (handled) unicast.emit(Lifecycle.Error, details);
        } finally {
          result.processes.forEach((process) => state.current.prune(process));
          setModel({ ...state.current.model });
          task.resolve();
        }
      }

      isDistributedAction(action)
        ? broadcast.on(action, handler)
        : unicast.on(action, handler);
    });
  }, [unicast]);

  const run = React.useEffectEvent(() => {
    bindings?.forEach((entry) => {
      const context = { model, inspect: state.current.inspect };
      const dependencies = entry.getDependencies(context);
      const checksum = utils.checksum(dependencies);
      if (G.isNullable(checksum)) return;
      const previous = reactives.current.get(entry.action) ?? null;
      if (checksum === previous) return;
      reactives.current.set(entry.action, checksum);
      const payload = entry.getPayload?.(context);
      unicast.emit(entry.action, payload);
    });
  });

  React.useEffect(() => {
    if (G.isNullable(instance.current)) return;
    run();
  });

  React.useLayoutEffect(() => {
    unicast.emit(Lifecycle.Mount);
    return () => void unicast.emit(Lifecycle.Unmount);
  }, []);

  React.useEffect(() => {
    unicast.emit(Lifecycle.Node);
  }, []);

  // Set up polling intervals
  // Note: We use refs to access the latest model and inspect in the interval callback
  // to avoid recreating intervals on every model change
  const modelRef = React.useRef(model);
  const inspectRef = React.useRef(state.current.inspect);
  React.useLayoutEffect(() => {
    modelRef.current = model;
    inspectRef.current = state.current.inspect;
  }, [model]);

  React.useEffect(() => {
    if (!pollBindings) return;

    const intervals: ReturnType<typeof setInterval>[] = [];

    pollBindings.forEach((entry) => {
      const intervalId = setInterval(() => {
        const context = {
          model: modelRef.current,
          inspect: inspectRef.current,
        };
        if (entry.getStatus(context) === Status.Pause) return;
        const payload = entry.getPayload?.(context);
        unicast.emit(entry.action, payload);
      }, entry.interval);
      intervals.push(intervalId);
    });

    return () => {
      intervals.forEach((id) => clearInterval(id));
    };
  }, [unicast, pollBindings]);

  return React.useMemo(
    () => [
      model,
      {
        dispatch(...[action, payload]: [action: Action, payload?: Payload]) {
          if (isDistributedAction(action)) broadcast.emit(action, payload);
          else unicast.emit(action, payload);
        },
        consume() {},
        get inspect() {
          return state.current.inspect;
        },
      },
    ],
    [model, unicast],
  );
}

/**
 * Creates a snapshot of a given object, returning a memoized version.
 * The snapshot provides stable access to the object's properties,
 * even as the original object changes across renders.
 *
 * @template T The type of the object.
 * @param {T} props The object to create a snapshot of.
 * @returns {T} A memoized snapshot of the object.
 */
export function useSnapshot<P extends Props>(props: P): P {
  const ref = React.useRef<P>(props);

  React.useLayoutEffect((): void => {
    ref.current = props;
  }, [props]);

  return React.useMemo(() => withGetters<P>(props, ref), [props]);
}
