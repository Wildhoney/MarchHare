import * as React from "react";
import { Button, Flex, Typography } from "antd";
import { Lifecycle } from "march-hare";
import { PromoteUserButton } from "../promote-user-button/index.tsx";
import { useActions } from "./actions.ts";
import { Actions } from "./types.ts";
import { Status } from "../../types.ts";

export function Dashboard(): React.ReactElement {
  const [model, actions, data] = useActions();

  return (
    <section style={{ background: "white", minHeight: "100vh", padding: 24 }}>
      <Typography.Title>Hey, {model.user ?? "Guest"}!</Typography.Title>

      {actions.stream(
        Lifecycle.Env,
        (env) =>
          env.status === Status.Guest && (
            <Button
              type="primary"
              loading={actions.inspect.user.pending()}
              onClick={() => actions.dispatch(Actions.SignIn)}
            >
              {actions.inspect.user.pending() ? "Signing in…" : "Sign in"}
            </Button>
          ),
      )}

      {actions.stream(
        Lifecycle.Env,
        (env) =>
          env.status === Status.Authenticated && (
            <Flex gap="small">
              <Button onClick={() => actions.dispatch(Actions.SignOut)}>
                Sign out
              </Button>

              <PromoteUserButton />

              <Button
                color="danger"
                variant="text"
                disabled={model.deleteUser}
                onClick={() => actions.dispatch(Actions.DeleteUser)}
              >
                {model.deleteUser ? "Not found" : "Delete user"}
              </Button>
            </Flex>
          ),
      )}

      {data.contextHolder()}
    </section>
  );
}
