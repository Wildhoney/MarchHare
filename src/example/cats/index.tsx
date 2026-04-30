import * as React from "react";
import { Router, route } from "react-wayfinder";
import { Boundary, Error, Reason } from "../../library/index.ts";
import { useSessionActions, useViewerActions } from "./actions.ts";
import { Actions, type SessionModel } from "./types.ts";
import { HttpError, RateLimitedError } from "./api.ts";
import * as styles from "./styles.ts";

const SessionContext = React.createContext<SessionModel>({
  viewCount: 0,
  history: [],
});

const routes = [
  route({
    url: "/:index",
    component({ params }) {
      const parsed = Number(params.index);
      const index =
        Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : 0;
      return <Viewer index={index} />;
    },
  }),
  route({
    url: "*",
    component() {
      // Lands on bare /cats — replace into /cats/0 so the back button
      // doesn't bounce the user out of the example.
      React.useEffect(() => {
        window.navigation.navigate("/cats/0", { history: "replace" });
      }, []);
      return null;
    },
  }),
];

export default function Cats(): React.ReactElement {
  return (
    <Boundary>
      <Error<HttpError>
        handler={({ reason, error }) => {
          if (reason !== Reason.Errored) return;
          if (error instanceof RateLimitedError) {
            console.warn(
              `Cat API rate-limited; retry after ${error.retryAfter}s`,
            );
            return;
          }
          if (error instanceof HttpError) {
            console.error(`Cat API failed: ${error.status} ${error.url}`);
          }
        }}
      >
        <Session>
          <Router routes={routes} base="/cats" />
        </Session>
      </Error>
    </Boundary>
  );
}

function Session({ children }: { children: React.ReactNode }) {
  // Listens to CatViewed broadcasts from every Viewer instance, regardless
  // of which route is active. The model lives outside the Router so it
  // survives route changes — ordinary per-component state would reset.
  const [model] = useSessionActions();
  return (
    <SessionContext.Provider value={model}>{children}</SessionContext.Provider>
  );
}

function Viewer({ index }: { index: number }): React.ReactElement {
  const session = React.useContext(SessionContext);
  const [model, actions] = useViewerActions({ index });
  const cat = model.cat;
  const pending = actions.inspect.cat.pending();

  return (
    <main className={styles.layout}>
      <header className={styles.header}>
        <h1>Cat #{index + 1}</h1>
        <p className={styles.tagline}>
          Powered by Chizu, ky &amp; Wayfinder &mdash; you have viewed{" "}
          {session.viewCount} unique {session.viewCount === 1 ? "cat" : "cats"}{" "}
          this session
        </p>
      </header>

      <figure className={styles.figure}>
        {!cat ? (
          <div className={styles.skeleton} />
        ) : (
          <img
            src={cat.url}
            alt={`Cat ${cat.id}`}
            className={styles.image}
            style={{ opacity: pending ? 0.6 : 1 }}
          />
        )}
        {pending && cat && <div className={styles.spinner} />}
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
          onClick={() => actions.dispatch(Actions.Refresh)}
          disabled={!cat || pending}
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

      {session.history.length > 0 && (
        <aside className={styles.history}>
          <h2>Recently viewed</h2>
          <ol>
            {session.history.map((id) => (
              <li key={id}>
                <code>{id}</code>
              </li>
            ))}
          </ol>
        </aside>
      )}
    </main>
  );
}
