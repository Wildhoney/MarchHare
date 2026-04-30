import * as React from "react";
import { Boundary } from "../../library/index.ts";
import { useTransactionsActions } from "./actions.ts";
import { Actions } from "./types.ts";
import * as styles from "./styles.ts";

export default function Transactions(): React.ReactElement {
  return (
    <Boundary>
      <Viewer />
    </Boundary>
  );
}

function Viewer(): React.ReactElement {
  const [model, actions] = useTransactionsActions();
  const sentinelRef = React.useRef<HTMLDivElement>(null);
  const pending = actions.inspect.items.pending();

  React.useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          actions.dispatch(Actions.LoadMore);
        }
      },
      { rootMargin: "200px" },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [actions]);

  return (
    <main className={styles.layout}>
      <header className={styles.header}>
        <h1>Transactions</h1>
        <button
          className={styles.refresh}
          onClick={() => actions.dispatch(Actions.Refresh)}
          disabled={pending}
        >
          &#x21bb; Refresh
        </button>
      </header>

      {model.items.length === 0 && pending ? (
        <div className={styles.empty}>Loading transactions&hellip;</div>
      ) : (
        <ul className={styles.list}>
          {model.items.map((tx) => (
            <li key={tx.id} className={styles.item}>
              <div className={styles.itemMain}>
                <span className={styles.merchant}>{tx.merchant}</span>
                <span className={styles.description}>{tx.description}</span>
              </div>
              <span className={styles.amount}>
                &minus;{tx.currency} {tx.amount.toFixed(2)}
              </span>
            </li>
          ))}
        </ul>
      )}

      {model.hasMore && (
        <div ref={sentinelRef} className={styles.sentinel}>
          {pending && <span className={styles.spinner} />}
          {pending ? "Loading more&hellip;" : null}
        </div>
      )}

      {!model.hasMore && model.items.length > 0 && (
        <div className={styles.end}>You&apos;ve reached the end.</div>
      )}
    </main>
  );
}
