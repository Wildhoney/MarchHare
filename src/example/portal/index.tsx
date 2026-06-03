import * as React from "react";
import { app } from "../app.ts";
import { Dashboard } from "./components/dashboard/index.tsx";

export default function Portal(): React.ReactElement {
  return (
    <app.Boundary>
      <Dashboard />
    </app.Boundary>
  );
}
