import * as React from "react";
import { app } from "../app.ts";
import Happy from "./components/happy/index.tsx";
import Sad from "./components/sad/index.tsx";
import type { MulticastActions } from "./types.ts";
import * as styles from "./styles.ts";

export const scope = app.Scope<typeof MulticastActions>();

export default function Mood(): React.ReactElement {
  return (
    <scope.Boundary>
      <section className={styles.container}>
        <Happy />
        <Sad />
      </section>
    </scope.Boundary>
  );
}
