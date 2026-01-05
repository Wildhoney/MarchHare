import * as React from "react";
import {
  withGetters,
  useReactives,
  useLifecycle,
  usePollings,
} from "./utils.ts";
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
import { ConsumeRenderer, ConsumerRenderer } from "../consumer/index.tsx";
import { getReason, normaliseError } from "../utils/index.ts";
import EventEmitter from "eventemitter3";
import { useBroadcast } from "../broadcast/index.tsx";
import { isDistributedAction, getActionName } from "../action/index.ts";
import { useError } from "../error/index.tsx";
import { State, Operation, Process } from "immertation";
import { context } from "../use/index.ts";
import { Regulator, useRegulators } from "../regulator/utils.ts";

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
  AC extends ActionsClass,
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
        const generator = <Generator | AsyncGenerator>handler(context, payload);

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
export function useActions<M extends Model, AC extends ActionsClass>(
  initialModel: M,
  ActionClass: Actions<M, AC> | (new () => unknown),
): UseActions<M, AC> {
  const broadcast = useBroadcast();
  const handleError = useError();
  const regulators = useRegulators();
  const [model, setModel] = React.useState<M>(initialModel);
  const hydration = React.useRef<Process | null>(null);
  const state = React.useRef<State<M>>(
    (() => {
      const state = new State<M>();
      hydration.current = state.hydrate(initialModel);
      return state;
    })(),
  );
  const snapshot = useSnapshot({ model, inspect: state.current.inspect });
  const unicast = React.useMemo(() => new EventEmitter(), []);
  const actions = React.useMemo(
    () => new (<Actions<M, AC>>ActionClass)(),
    [ActionClass],
  );
  const regulator = React.useRef<Regulator>(new Regulator(regulators));
  const checksums = React.useRef<Map<symbol, string | null>>(new Map());

  /**
   * Creates the context object passed to action handlers during dispatch.
   *
   * The context provides action handlers with access to:
   * - **model**: Current immutable model state
   * - **signal**: AbortSignal for cooperative cancellation
   * - **regulator**: Methods to abort actions and control execution policies
   * - **actions**: API for producing state changes, dispatching other actions, and annotating values
   *
   * @param action The action symbol being dispatched.
   * @param result Container for tracking Immertation processes created during execution.
   * @returns A fully-typed Context object for the action handler.
   */
  const getContext = React.useCallback(
    (action: Action, result: Result) => {
      const controller = regulator.current.controller(action);

      return <Context<M, AC>>{
        model,
        signal: controller.signal,
        regulator: {
          abort: {
            own: () => regulator.current.abort.own(),
            all: () => regulator.current.abort.all(),
            matching: (actions: Action[]) =>
              regulator.current.abort.matching(actions),
            self: () => regulator.current.abort.matching([action]),
          },
          policy: {
            allow: {
              own: () => regulator.current.policy.allow.own(),
              all: () => regulator.current.policy.allow.all(),
              matching: (actions: Action[]) =>
                regulator.current.policy.allow.matching(actions),
              self: () => regulator.current.policy.allow.matching([action]),
            },
            disallow: {
              own: () => regulator.current.policy.disallow.own(),
              all: () => regulator.current.policy.disallow.all(),
              matching: (actions: Action[]) =>
                regulator.current.policy.disallow.matching(actions),
              self: () => regulator.current.policy.disallow.matching([action]),
            },
          },
        },
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
          dispatch(...[action, payload]: [action: Action, payload?: Payload]) {
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
    type ActionHandler = (
      context: Context<M, AC>,
      payload: Payload,
    ) => void | Promise<void>;

    Object.getOwnPropertySymbols(actions).forEach((action) => {
      async function handler(payload: Payload) {
        const result = <Result>{ processes: new Set<Process>() };
        const task = Promise.withResolvers<void>();
        try {
          const handler = <ActionHandler>actions[<keyof typeof actions>action];
          await handler(getContext(action, result), payload);
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

  useReactives({ actions: <object>actions, model, state, checksums, unicast });

  useLifecycle({ unicast, regulator });

  usePollings({ actions: <object>actions, snapshot, unicast });

  React.useEffect(() => {
    regulators.add(regulator.current);
    return () => {
      regulators.delete(regulator.current);
    };
  }, []);

  return React.useMemo(
    () => <UseActions<M, AC>>(<unknown>[
        model,
        {
          dispatch(...[action, payload]: [action: Action, payload?: Payload]) {
            if (isDistributedAction(action)) broadcast.emit(action, payload);
            else unicast.emit(action, payload);
          },
          consume(
            action: symbol,
            renderer: ConsumerRenderer<unknown>,
          ): React.ReactNode {
            return React.createElement(ConsumeRenderer, {
              action,
              renderer,
            });
          },
          get inspect() {
            return state.current.inspect;
          },
        },
      ]),
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
