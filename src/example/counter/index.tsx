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
        </div>

        <div className={styles.group}>
          <button
            className={styles.button}
            onClick={() => actions.dispatch(Actions.Decrement)}
          >
            −
          </button>

          <div
            className={styles.display}
            data-testid="count"
            data-count={model.count}
          >
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

        <div data-testid="derived">
          {model.anExample && <span>Derived: {model.anExample}</span>}
          {model.anotherExample !== null && (
            <span> | Doubled: {model.anotherExample}</span>
          )}
        </div>

        <div
          className={styles.loading}
          data-testid="loading"
          style={{
            opacity: actions.inspect.count.pending() ? 1 : 0,
            transform: actions.inspect.count.pending()
              ? "translateY(0px)"
              : "translateY(-5px)",
          }}
        >
          <div className={styles.spinner} />
          <span className={styles.remaining}>
            Remaining: {actions.inspect.count.remaining()} (next:{" "}
            {actions.inspect.count.draft()})
          </span>
        </div>
      </div>
    </section>
  );
}
