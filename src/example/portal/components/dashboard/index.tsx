import * as React from "react";
import { Flex, Typography } from "antd";
import { Lifecycle } from "march-hare";
import { AsyncButton } from "../async-button/index.tsx";
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
            <AsyncButton
              type="primary"
              onClick={() => actions.dispatch(Actions.SignIn)}
            >
              Sign in
            </AsyncButton>
          ),
      )}

      {actions.stream(
        Lifecycle.Env,
        (env) =>
          env.status === Status.Authenticated && (
            <Flex gap="small">
              <AsyncButton onClick={() => actions.dispatch(Actions.SignOut)}>
                Sign out
              </AsyncButton>

              <AsyncButton
                type="primary"
                onClick={() => actions.dispatch(Actions.AddUser)}
              >
                Promote user
              </AsyncButton>

              <AsyncButton
                color="danger"
                variant="text"
                disabled={model.deleteUser}
                onClick={() => actions.dispatch(Actions.DeleteUser)}
              >
                {model.deleteUser ? "Not found" : "Delete user"}
              </AsyncButton>
            </Flex>
          ),
      )}

      {data.contextHolder()}
    </section>
  );
}
