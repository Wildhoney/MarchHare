import * as React from "react";
import { withScope } from "march-hare";
import Happy from "./components/happy/index.tsx";
import Sad from "./components/sad/index.tsx";
import { Scope } from "./types.ts";
import * as styles from "./styles.ts";

function Mood(): React.ReactElement {
  return (
    <section className={styles.container}>
      <Happy />
      <Sad />
    </section>
  );
}

export default withScope(Scope.Mood, Mood);
