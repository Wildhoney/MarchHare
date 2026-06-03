import * as React from "react";
import { useActions } from "./actions.ts";
import { Actions } from "./types.ts";
import { Lifecycle } from "march-hare";
import { Status } from "../../types.ts";

export function Dashboard(): React.ReactElement {
  const [model, actions] = useActions();

  return (
    <section>
      <h1>Hey, {model.user ?? "Guest"}!</h1>

      {actions.stream(
        Lifecycle.Env,
        (env) =>
          env.status === Status.Guest && (
            <button
              disabled={actions.inspect.user.pending()}
              onClick={() => actions.dispatch(Actions.SignIn)}
            >
              {actions.inspect.user.pending() ? "Signing in..." : "Sign in"}
            </button>
          ),
      )}

      {actions.stream(
        Lifecycle.Env,
        (env) =>
          env.status === Status.Authenticated && (
            <button onClick={() => actions.dispatch(Actions.SignOut)}>
              Sign out
            </button>
          ),
      )}
    </section>
  );
}
