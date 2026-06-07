import * as React from "react";
import { useActions } from "../actions/index.ts";
import { bindWith } from "../with/index.ts";
import type {
  Actions,
  Context as ContextHandle,
  Model,
  Props,
  UseActions,
} from "../types/index.ts";
import type { DispatchTarget } from "./types.ts";

/**
 * Returns a stable, typed controller handle up-front &mdash; before a
 * model is declared via `context.useActions(...)`. Use this when an
 * external imperative library (form, animation, third-party SDK) needs a
 * dispatch callback at construction time, while the value that library
 * returns must flow back into the controller's data callback.
 *
 * The handle exposes `dispatch(action, payload?)`, a `useActions(...)`
 * method that materialises the component-local model and reactive data
 * &mdash; the M and D pair of `useContext<M, AC, D>` &mdash; and
 * returns the `[model, actions, data]` tuple with `useAction`, `dispatch`,
 * `inspect`, and `stream` attached, plus `with` &mdash; a bag of handler
 * factories (`update`/`invert`/`always`) typed against the declared model
 * and accepting lodash-style dotted paths and array indices. The first
 * invocation of `context.actions.dispatch(...)` must come from an event
 * handler &mdash; not synchronously during render &mdash; because the
 * underlying dispatch target is wired up when `context.useActions(...)`
 * runs in the same render pass.
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
 *   { user: resource.user() },
 *   () => ({ form }),
 * );
 * ```
 *
 * @internal
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
      with: bindWith<M>(),
    });
  }, []);
}
