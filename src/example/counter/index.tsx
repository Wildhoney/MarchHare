import { useCounterActions } from "./actions.ts";
import { Actions } from "./types.ts";
import * as styles from "./styles.ts";
import * as React from "react";
import FlipNumbers from "react-flip-numbers";

export default function Counter(): React.ReactElement {
  const [model, actions] = useCounterActions();

  return (
    <section className={styles.container}>
      <div className={styles.card}>
        <div className={styles.header}>
          <h1 className={styles.title}>Counter</h1>
          {actions.inspect.count.pending() && (
            <div className={styles.loading}>
              <div className={styles.spinner} />
            </div>
          )}
        </div>

        <div className={styles.group}>
          <button
            className={styles.button}
            onClick={() => actions.dispatch(Actions.Decrement)}
          >
            −
          </button>

          <div className={styles.display}>
            <FlipNumbers
              height={48}
              width={32}
              color="#333"
              background="#fafafa"
              play
              numbers={String(model.count)}
            />
          </div>

          <button
            className={styles.button}
            onClick={() => actions.dispatch(Actions.Increment)}
          >
            +
          </button>
        </div>
      </div>
    </section>
  );
}
