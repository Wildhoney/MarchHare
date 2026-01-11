import * as React from "react";
import { withGetters, useLifecycle } from "./utils.ts";
import type { ActionHandler, ActionsScope } from "./types.ts";
import {
  meta,
  ReactiveInterface,
  ReactiveContext,
  Lifecycle,
  Model,
  Payload,
  Primitive,
  Props,
  ActionsClass,
  Action,
  UseActions,
  Result,
  ExtractPayload,
} from "../types/index.ts";
import { ConsumeRenderer, ConsumerRenderer } from "../consumer/index.tsx";
import { getReason, normaliseError } from "../utils/index.ts";
import EventEmitter from "eventemitter3";
import { useBroadcast } from "../broadcast/index.tsx";
import { isDistributedAction, getActionName } from "../action/index.ts";
import { useError } from "../error/index.tsx";
import { State, Operation, Process } from "immertation";
import { Regulator, useRegulators } from "../regulator/utils.ts";

function useRegisterHandler<M extends Model, AC extends ActionsClass>(
  scope: React.RefObject<ActionsScope>,
  action: symbol,
  handler: (
    context: ReactiveInterface<M, AC>,
    payload: unknown,
  ) => void | Promise<void> | AsyncGenerator | Generator,
): void {
  const stableHandler = React.useEffectEvent(
    async (context: ReactiveInterface<M, AC>, payload: unknown) => {
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

  scope.current.handlers.set(action, <ActionHandler>stableHandler);
}

/**
 * A hook for managing state with actions.
 *
 * Call `useActions` first, then use `actions.useAction` to bind handlers
 * to action symbols. Types are pre-baked from the generic parameters, so
 * no additional type annotations are needed on handler calls.
 *
 * The hook returns a tuple containing:
 * 1. The current model state
 * 2. An actions object with `dispatch`, `consume`, `inspect`, and `useAction`
 *
 * The `inspect` property provides access to Immertation's annotation system,
 * allowing you to check for pending operations on model properties.
 *
 * @template M The model type representing the component's state.
 * @template AC The actions class containing action definitions.
 * @param initialModel The initial model state.
 * @returns A tuple `[model, actions]` with pre-typed `useAction` method.
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
 * // Component usage
 * function Visitor() {
 *   const [model, actions] = useVisitorActions();
 *   return <div>{model.visitor?.name}</div>;
 * }
 * ```
 */
export function useActions<M extends Model, AC extends ActionsClass>(
  initialModel: M,
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
  const scope = React.useRef<ActionsScope>({
    handlers: new Map(),
  });
  const regulator = React.useRef<Regulator>(new Regulator(regulators));

  /**
   * Creates the context object passed to action handlers during dispatch.
   *
   * @param action The action symbol being dispatched.
   * @param result Container for tracking Immertation processes created during execution.
   * @returns A fully-typed Context object for the action handler.
   */
  const getContext = React.useCallback(
    (action: Action, result: Result) => {
      const controller = regulator.current.controller(action);

      return <ReactiveInterface<M, AC>>{
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
            isDistributedAction(action)
              ? broadcast.emit(action, payload)
              : unicast.emit(action, payload);
          },
          annotate<T>(operation: Operation, value: T): T {
            return state.current.annotate(operation, value);
          },
        },
        [meta]: {
          controller,
        },
      };
    },
    [snapshot.model],
  );

  React.useLayoutEffect(() => {
    function createHandler(action: symbol, actionHandler: ActionHandler) {
      return async function handler(payload: Payload) {
        const result = <Result>{ processes: new Set<Process>() };
        const task = Promise.withResolvers<void>();
        try {
          await actionHandler(getContext(action, result), payload);
        } catch (error) {
          const hasErrorHandler = scope.current.handlers.has(Lifecycle.Error);
          const details = {
            reason: getReason(error),
            error: normaliseError(error),
            action: getActionName(action),
            handled: hasErrorHandler,
          };
          handleError?.(details);
          if (hasErrorHandler) unicast.emit(Lifecycle.Error, details);
        } finally {
          result.processes.forEach((process) => state.current.prune(process));
          setModel({ ...state.current.model });
          task.resolve();
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

  useLifecycle({ unicast, regulator });

  React.useEffect(() => {
    regulators.add(regulator.current);
    return () => {
      regulators.delete(regulator.current);
    };
  }, []);

  const useActionMethod = <Act extends symbol>(
    action: Act,
    handler: (
      context: ReactiveInterface<M, AC>,
      payload: ExtractPayload<Act>,
    ) => void | Promise<void> | AsyncGenerator | Generator,
  ): void => {
    useRegisterHandler<M, AC>(scope, action, <ActionHandler<M, AC>>handler);
  };

  const useReactiveMethod = (
    dependencies: Primitive[],
    callback: (context: ReactiveContext<AC>) => void,
  ): void => {
    const dispatch = (action: AC[keyof AC], payload?: unknown) => {
      isDistributedAction(<Action>action)
        ? broadcast.emit(<Action>action, <Payload>payload)
        : unicast.emit(<Action>action, <Payload>payload);
    };

    const stableCallback = React.useEffectEvent(() => {
      callback({ dispatch });
    });

    React.useLayoutEffect(() => {
      stableCallback();
    }, dependencies);
  };

  const baseTuple = React.useMemo(() => {
    const actionsObj = {
      dispatch(...[action, payload]: [action: Action, payload?: Payload]) {
        isDistributedAction(action)
          ? broadcast.emit(action, payload)
          : unicast.emit(action, payload);
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
    };
    return <[M, typeof actionsObj]>[model, actionsObj];
  }, [model, unicast]);

  return <UseActions<M, AC>>Object.assign(baseTuple, {
    useAction: useActionMethod,
    useReactive: useReactiveMethod,
  });
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
