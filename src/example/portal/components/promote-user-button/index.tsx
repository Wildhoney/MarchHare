import * as React from "react";
import { Button } from "antd";
import { useActions } from "./actions.ts";
import { Actions } from "./types.ts";

export function PromoteUserButton(): React.ReactElement {
  const [model, actions] = useActions();

  return (
    <Button
      type="primary"
      loading={model.busy}
      onClick={() => actions.dispatch(Actions.Click)}
    >
      Promote user
    </Button>
  );
}
