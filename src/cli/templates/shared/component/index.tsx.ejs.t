---
to: src/shared/components/<%= name %>/index.tsx
---
import * as React from "react";
import type { Props } from "./types.ts";

export function <%= pascalName %>({ children, ...rest }: Props): React.ReactElement {
  return <div {...rest}>{children}</div>;
}
