import * as React from "react";
import { A } from "@mobily/ts-belt";
import { Button } from "@example/shared/components/button/index.tsx";
import { CatCard } from "@example/features/cat-card/index.tsx";
import { AddCatButton } from "@example/features/add-cat/index.tsx";
import { useActions } from "./actions.ts";
import { Actions } from "./types.ts";
import * as styles from "./styles.ts";

export function CatteryPage(): React.ReactElement {
  const [model, actions] = useActions();

  return (
    <main className={styles.layout}>
      <header className={styles.header}>
        <h1 className={styles.title}>Cattery</h1>
        <p className={styles.tagline}>
          Click the button to adopt a randomly named cat.
        </p>
      </header>

      <div className={styles.controls}>
        <AddCatButton />
        <Button size="large" onClick={() => actions.dispatch(Actions.OpenNew)}>
          Open a new Cattery
        </Button>
      </div>

      {A.isEmpty(model.cats) ? (
        <p className={styles.empty}>
          No cats yet &ndash; adopt your first one.
        </p>
      ) : (
        <section className={styles.grid}>
          {model.cats.map((cat) => (
            <CatCard key={cat.id} cat={cat} />
          ))}
        </section>
      )}
    </main>
  );
}
