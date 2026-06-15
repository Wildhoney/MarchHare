import * as React from "react";
import { Button } from "@example/shared/components/button/index.tsx";
import { useAddCatActions } from "./actions.ts";
import { Actions } from "./types.ts";

export function AddCatButton(): React.ReactElement {
  const [model, actions] = useAddCatActions();

  return (
    <Button
      type="primary"
      size="large"
      loading={model.pending}
      onClick={() => actions.dispatch(Actions.Click)}
    >
      Add a cat
    </Button>
  );
}
