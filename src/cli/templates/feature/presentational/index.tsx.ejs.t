---
to: src/features/<%= name %>/index.tsx
---
import * as React from "react";
import type { Props } from "./types.ts";
import { scope } from "./utils.ts";

export function <%= pascalName %>({ label }: Props): React.ReactElement {
  return (
    <scope.Boundary>
      <span>{label}</span>
    </scope.Boundary>
  );
}
