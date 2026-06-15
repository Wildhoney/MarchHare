import * as React from "react";
import type { Props } from "./types.ts";
import { scope } from "./utils.ts";
import * as styles from "./styles.ts";

export function CatCard({ cat }: Props): React.ReactElement {
  return (
    <scope.Boundary>
      <article className={styles.card}>
        <img className={styles.avatar} src={cat.avatar} alt={cat.name} />
        <p className={styles.name}>{cat.name}</p>
      </article>
    </scope.Boundary>
  );
}
