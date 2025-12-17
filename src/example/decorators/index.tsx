import { useDecoratorActions } from "./actions.ts";
import { Actions } from "./types.ts";
import * as React from "react";
import { css } from "@emotion/css";

const styles = {
  container: css`
    padding: 20px;
    font-family: system-ui, sans-serif;
    max-width: 800px;
    margin: 0 auto;
  `,
  section: css`
    margin-bottom: 24px;
    padding: 16px;
    border: 1px solid #ddd;
    border-radius: 8px;
  `,
  title: css`
    font-size: 18px;
    font-weight: 600;
    margin-bottom: 12px;
  `,
  button: css`
    padding: 8px 16px;
    margin-right: 8px;
    cursor: pointer;
    border: 1px solid #333;
    border-radius: 4px;
    background: #fff;
    &:hover {
      background: #f0f0f0;
    }
  `,
  log: css`
    margin-top: 12px;
    padding: 12px;
    background: #f5f5f5;
    border-radius: 4px;
    font-family: monospace;
    font-size: 12px;
    max-height: 200px;
    overflow-y: auto;
  `,
  logEntry: css`
    padding: 2px 0;
  `,
  value: css`
    font-size: 24px;
    font-weight: bold;
    margin-bottom: 12px;
  `,
};

export default function DecoratorTests(): React.ReactElement {
  const [model, actions] = useDecoratorActions();

  return (
    <div className={styles.container} data-testid="decorator-tests">
      <h1>Decorator Integration Tests</h1>

      {/* Supplant Test */}
      <section className={styles.section} data-testid="supplant-section">
        <h2 className={styles.title}>@use.supplant()</h2>
        <p>
          Only one instance runs at a time. Click rapidly to see previous calls
          get aborted.
        </p>
        <div className={styles.value} data-testid="supplant-value">
          Value: {model.value}
        </div>
        <button
          className={styles.button}
          data-testid="supplant-trigger"
          onClick={() => actions.dispatch(Actions.SupplantAction)}
        >
          Trigger Supplant Action
        </button>
      </section>

      {/* Debounce Test */}
      <section className={styles.section} data-testid="debounce-section">
        <h2 className={styles.title}>@use.debounce(300)</h2>
        <p>
          Waits 300ms after last call before executing. Rapid clicks result in
          one execution.
        </p>
        <div className={styles.value} data-testid="debounce-value">
          Value: {model.value}
        </div>
        <button
          className={styles.button}
          data-testid="debounce-trigger"
          onClick={() => actions.dispatch(Actions.DebounceAction)}
        >
          Trigger Debounce Action
        </button>
      </section>

      {/* Throttle Test */}
      <section className={styles.section} data-testid="throttle-section">
        <h2 className={styles.title}>@use.throttle(500)</h2>
        <p>
          Executes at most once per 500ms. First call immediate, subsequent
          queued.
        </p>
        <div className={styles.value} data-testid="throttle-value">
          Value: {model.value}
        </div>
        <button
          className={styles.button}
          data-testid="throttle-trigger"
          onClick={() => actions.dispatch(Actions.ThrottleAction)}
        >
          Trigger Throttle Action
        </button>
      </section>

      {/* Retry Test */}
      <section className={styles.section} data-testid="retry-section">
        <h2 className={styles.title}>@use.retry([100, 100])</h2>
        <p>
          Fails first 2 times, succeeds on 3rd. Retries with 100ms intervals.
        </p>
        <div className={styles.value} data-testid="retry-value">
          Value: {model.value} | Attempts: {model.attempts}
        </div>
        <button
          className={styles.button}
          data-testid="retry-trigger"
          onClick={() => actions.dispatch(Actions.RetryAction)}
        >
          Trigger Retry Action
        </button>
        <button
          className={styles.button}
          data-testid="retry-reset"
          onClick={() => actions.dispatch(Actions.ResetRetry)}
        >
          Reset Attempts
        </button>
      </section>

      {/* Timeout Test */}
      <section className={styles.section} data-testid="timeout-section">
        <h2 className={styles.title}>@use.timeout(200)</h2>
        <p>
          Action takes 1000ms but timeout is 200ms. Should abort with
          TimeoutError.
        </p>
        <div className={styles.value} data-testid="timeout-value">
          Value: {model.value}
        </div>
        <button
          className={styles.button}
          data-testid="timeout-trigger"
          onClick={() => actions.dispatch(Actions.TimeoutAction)}
        >
          Trigger Timeout Action
        </button>
      </section>

      {/* Log Display */}
      <section className={styles.section}>
        <h2 className={styles.title}>Action Log</h2>
        <button
          className={styles.button}
          data-testid="clear-log"
          onClick={() => actions.dispatch(Actions.ClearLog)}
        >
          Clear Log
        </button>
        <div className={styles.log} data-testid="action-log">
          {model.log.length === 0 ? (
            <div className={styles.logEntry}>No actions logged yet</div>
          ) : (
            model.log.map((entry, i) => (
              <div key={i} className={styles.logEntry} data-testid="log-entry">
                {entry}
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
