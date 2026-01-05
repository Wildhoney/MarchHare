import * as React from "react";
import { useVisitorActions } from "./actions.ts";
import * as styles from "./styles.ts";
import { Popover } from "antd";
import { A } from "@mobily/ts-belt";
import { DistributedActions } from "../types.ts";

export default function Visitor(): React.ReactElement | null {
  const [model, actions] = useVisitorActions();

  if (!model.connected) return null;

  const history = A.length(model.history) > 1 && (
    <div className={styles.history}>
      {model.history.slice(1).map((entry) => (
        <div key={entry.timestamp}>
          {entry.flag} {entry.name}
        </div>
      ))}
    </div>
  );

  return (
    <Popover content={history} placement="bottom">
      <div
        className={styles.container}
        data-counter={actions.consume(
          DistributedActions.Counter,
          (counter) => counter.value,
        )}
      >
        {model.visitor ? (
          <span key={model.visitor.timestamp} className={styles.visitor}>
            {model.visitor.flag} User visited from {model.visitor.name}
          </span>
        ) : (
          <span className={styles.waiting}>Waiting for visitors...</span>
        )}
      </div>
    </Popover>
  );
}
