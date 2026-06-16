---
to: src/app/pages/home/index.tsx
---
import * as React from "react";
import { GreetButton } from "@features/greet/index.tsx";
import { useActions } from "./actions.ts";
import * as styles from "./styles.ts";

export function HomePage(): React.ReactElement {
  const [model] = useActions();

  return (
    <main className={styles.layout}>
      <header className={styles.header}>
        <h1 className={styles.title}><%= title(name) %></h1>
        <p className={styles.tagline}>
          Click the button below to dispatch your first March Hare action.
        </p>
      </header>

      <GreetButton />

      {model.greeting ? (
        <p className={styles.greeting}>{model.greeting}</p>
      ) : (
        <p className={styles.empty}>No greeting yet — press the button.</p>
      )}
    </main>
  );
}
