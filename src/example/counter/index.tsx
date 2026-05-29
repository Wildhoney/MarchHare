import { useActions } from "./actions.ts";
import { Actions } from "./types.ts";
import * as styles from "./styles.ts";
import * as React from "react";

export default function Counter(): React.ReactElement {
  const [model, actions] = useActions();

  return (
    <section className={styles.container}>
      <div className={styles.card}>
        <div className={styles.header}>
          <h1 className={styles.title}>User</h1>
        </div>

        <div className={styles.display} data-testid="user">
          {model.user?.name ?? "—"}
        </div>

        <button
          className={styles.button}
          data-testid="refresh"
          onClick={() => actions.dispatch(Actions.User)}
        >
          ↻
        </button>
      </div>
    </section>
  );
}
