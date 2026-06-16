---
to: src/features/greet/index.tsx
---
import * as React from "react";
import { Button } from "@shared/components/button/index.tsx";
import { useActions } from "./actions.ts";
import { scope } from "./utils.ts";
import { Actions } from "./types.ts";

export function GreetButton(): React.ReactElement {
  const [, actions] = useActions();

  return (
    <scope.Boundary>
      <Button
        type="primary"
        size="large"
        onClick={() => actions.dispatch(Actions.Click)}
      >
        Say hello
      </Button>
    </scope.Boundary>
  );
}
