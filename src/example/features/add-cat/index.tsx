import * as React from "react";
import { Button } from "@example/shared/components/button/index.tsx";
import { useActions } from "./actions.ts";
import { scope } from "./utils.ts";
import { Actions } from "./types.ts";

export function AddCatButton(): React.ReactElement {
  const [, actions] = useActions();

  return (
    <scope.Boundary>
      <Button
        type="primary"
        size="large"
        loading={actions.inspect.image.pending()}
        onClick={() => actions.dispatch(Actions.Click)}
      >
        Add a cat
      </Button>
    </scope.Boundary>
  );
}
