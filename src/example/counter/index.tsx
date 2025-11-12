import { useCounterActions } from "./actions.ts";
import { Actions } from "./types.ts";
import * as styles from "./styles.ts";
import * as React from "react";
import FlipNumbers from "react-flip-numbers";

export default function Counter(): React.ReactElement {
  const [model, actions] = useCounterActions();

  // TODO: Replace with actual remaining() function from immertation library
  const remaining = () => 0;

  return (
    <section className={styles.container}>
      <div className={styles.card}>
        <div className={styles.header}>
          <h1 className={styles.title}>Counter</h1>
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

        <div
          className={styles.loading}
          style={{
            opacity: actions.inspect.count.pending() ? 1 : 0,
            transform: actions.inspect.count.pending()
              ? "translateY(0px)"
              : "translateY(-5px)",
          }}
        >
          <div className={styles.spinner} />
          <span className={styles.remaining}>Remaining: {remaining()}</span>
        </div>
      </div>
    </section>
  );
}
