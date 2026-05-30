import * as React from "react";
import { useActions } from "./actions.ts";
import { Actions, type Props } from "./types.ts";
import * as styles from "./styles.ts";

export function Cat({ index }: Props): React.ReactElement {
  const [model, actions] = useActions({ index });

  return (
    <main className={styles.layout}>
      <header className={styles.header}>
        <h1>Cat #{index + 1}</h1>

        <p className={styles.tagline}>
          Powered by March Hare, ky &amp; Wayfinder
        </p>
      </header>

      <figure className={styles.figure}>
        {!model.cat ? (
          <div className={styles.skeleton} />
        ) : (
          <img
            src={model.cat.url}
            alt={`Cat ${model.cat.id}`}
            className={styles.image}
          />
        )}
      </figure>

      <div className={styles.controls}>
        <button
          className={styles.button}
          onClick={() => actions.dispatch(Actions.Previous)}
          disabled={index === 0}
        >
          &larr; Previous
        </button>

        <button
          className={styles.button}
          onClick={() => actions.dispatch(Actions.Get)}
          disabled={!model.cat}
        >
          &#x21bb; Refresh
        </button>

        <button
          className={`${styles.button} ${styles.primary}`}
          onClick={() => actions.dispatch(Actions.Next)}
        >
          Next Cat &rarr;
        </button>
      </div>
    </main>
  );
}
