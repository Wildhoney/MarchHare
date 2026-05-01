import * as React from "react";
import { Router } from "react-wayfinder";
import { Boundary } from "../../library/index.ts";
import { routes } from "./utils.tsx";

export default function Cats(): React.ReactElement {
  return (
    <Boundary>
      <Router routes={routes} base="/cats" />
    </Boundary>
  );
}
