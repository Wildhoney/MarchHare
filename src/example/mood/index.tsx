import * as React from "react";
import { Scope } from "../../library/index.ts";
import Happy from "./components/happy/index.tsx";
import Sad from "./components/sad/index.tsx";
import { MulticastActions } from "./types.ts";
import * as styles from "./styles.ts";

export default function Mood(): React.ReactElement {
  return (
    <Scope of={MulticastActions.Scope}>
      <section className={styles.container}>
        <Happy />
        <Sad />
      </section>
    </Scope>
  );
}
