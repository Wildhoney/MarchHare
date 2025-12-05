/* eslint-disable @typescript-eslint/no-unsafe-function-type */
/* eslint-disable @typescript-eslint/no-explicit-any */
import * as React from "react";
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
} from "../types/index.ts";
import EventEmitter from "eventemitter3";
import { useBroadcast } from "../broadcast/index.tsx";
import { isDistributedAction } from "../action/index.ts";
import { useActionError } from "../error/index.tsx";
import { State, Operation, Process } from "immertation";

/**
 * Memoizes an action handler for performance optimization.
 *
 * @template Model The type of the model.
 * @template Actions The type of the actions.
 * @template Action The specific action being handled.
 * @param {(context: Context<Model, Actions>, name: Action) => void} action The action handler function.
 * @returns {React.useCallback} The memoized action handler.
 */
export function useAction<
  M extends Model,
  AC extends ActionsClass<any>,
  K extends never | Exclude<keyof AC, "prototype"> = never,
>(
  handler: (
    context: Context<M, AC>,
    payload: AC[K] extends Payload<infer P> ? P : never,
  ) => void | Promise<void> | AsyncGenerator | Generator,
) {
  const handleError = useActionError();

  return React.useCallback(
    async (
      context: Context<M, AC>,
      payload: AC[K] extends Payload<infer P> ? P : never,
    ) => {
      try {
        const isGenerator =
          handler.constructor.name === "GeneratorFunction" ||
          handler.constructor.name === "AsyncGeneratorFunction";

        if (isGenerator) {
          const generator = handler(context, payload) as
            | Generator
            | AsyncGenerator;
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          for await (const _ of generator) void 0;
        } else {
          await handler(context, payload);
        }
      } catch (error) {
        console.error("Chizu\n\n", error);
        handleError?.(<Error>error);
      }
    },
    [handler, handleError],
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
 *   const [model, actions] = useActions();
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
  const [model, setModel] = React.useState<M>(initialModel);
  const state = React.useRef<State<M>>(new State<M>(initialModel));
  const snapshot = useSnapshot({ model });
  const unicast = React.useMemo(() => new EventEmitter(), []);

  const getContext = React.useCallback(
    (result: Result) => {
      const controller = new AbortController();

      return <Context<M, AC>>{
        signal: controller.signal,
        actions: {
          produce(f) {
            if (controller.signal.aborted) return;
            const process = state.current.mutate((draft) => f(draft));
            setModel(state.current.model);
            result.processes.add(process);
          },
          dispatch(...[action, payload]: [action: any, payload?: any]) {
            if (controller.signal.aborted) return;
            if (isDistributedAction(action))
              broadcast.instance.emit(action, payload);
            else unicast.emit(action, payload);
          },
          annotate<T>(operation: Operation, value: T): T {
            return state.current.annotate(operation, value);
          },
        },
      };
    },
    [snapshot.model],
  );

  React.useLayoutEffect(() => {
    const actions = new (<Actions<M, AC>>ActionClass)();

    Object.getOwnPropertySymbols(actions).forEach((action) => {
      const key = <keyof typeof actions>action;

      if (isDistributedAction(action)) {
        return void broadcast.instance.on(action, async (payload) => {
          const result = <Result>{ processes: new Set<Process>() };
          const task = Promise.withResolvers<void>();
          await (<Function>actions[key])(getContext(result), payload);
          result.processes.forEach((process) => state.current.prune(process));
          task.resolve();
        });
      }

      unicast.on(action, async (payload) => {
        const result = <Result>{ processes: new Set<Process>() };
        const task = Promise.withResolvers<void>();
        await (<Function>actions[key])(getContext(result), payload);
        result.processes.forEach((process) => state.current.prune(process));
        task.resolve();
      });
    });
  }, [unicast]);

  React.useLayoutEffect(() => {
    unicast.emit(Lifecycle.Mount);
    return () => void unicast.emit(Lifecycle.Unmount);
  }, []);

  return React.useMemo(
    () => [
      model,
      {
        dispatch(...[action, payload]: [action: Action, payload?: Payload]) {
          if (isDistributedAction(action))
            broadcast.instance.emit(action, payload);
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
