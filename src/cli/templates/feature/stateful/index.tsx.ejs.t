---
to: src/features/<%= name %>/index.tsx
---
import * as React from "react";
import { useActions } from "./actions.ts";
import { scope } from "./utils.ts";
import { Actions } from "./types.ts";

export function <%= pascalName %>(): React.ReactElement {
  const [model, actions] = useActions();

  return (
    <scope.Boundary>
      <button onClick={() => actions.dispatch(Actions.Tick)}>
        <%= pascalName %> ({model.count})
      </button>
    </scope.Boundary>
  );
}
