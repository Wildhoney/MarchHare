---
to: src/app/pages/<%= name %>/index.tsx
---
import * as React from "react";
import { useActions } from "./actions.ts";
import * as styles from "./styles.ts";

export function <%= pascalName %>Page(): React.ReactElement {
  const [model] = useActions();

  return (
    <main className={styles.layout}>
      <header className={styles.header}>
        <h1 className={styles.title}><%= heading %></h1>
        <p className={styles.tagline}><%= tagline %></p>
      </header>
      <p>Model says: {JSON.stringify(model)}</p>
    </main>
  );
}
