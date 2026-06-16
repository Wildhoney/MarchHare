---
to: src/app/index.tsx
---
import * as React from "react";
import { app } from "./utils.ts";
import { HomePage } from "./pages/home/index.tsx";

export function Root(): React.ReactElement {
  return (
    <app.Boundary>
      <HomePage />
    </app.Boundary>
  );
}
