import * as React from "react";
import { app } from "./utils.ts";
import { CatteryPage } from "./pages/cattery/index.tsx";

export function Root(): React.ReactElement {
  return (
    <app.Boundary>
      <CatteryPage />
    </app.Boundary>
  );
}
