---
to: src/shared/components/<%= name %>/types.ts
---
import type { HTMLAttributes, ReactNode } from "react";

export type Props = HTMLAttributes<HTMLDivElement> & {
  children?: ReactNode;
};
