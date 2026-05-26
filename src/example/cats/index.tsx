import * as React from "react";
import { Router } from "react-wayfinder";
import { Boundary } from "march-hare";
import { routes } from "./utils.tsx";

export default function Cats(): React.ReactElement {
  return (
    <Boundary>
      <Router routes={routes} base="/cats" />
    </Boundary>
  );
}
