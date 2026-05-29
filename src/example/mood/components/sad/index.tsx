import * as React from "react";
import { useActions } from "./actions.ts";
import { Actions } from "./types.ts";
import { Mood } from "../../types.ts";
import { isInactive } from "../../utils.ts";
import * as styles from "../../styles.ts";
import { cx } from "@emotion/css";

export default function Sad(): React.ReactElement {
  const [model, actions] = useActions();

  return (
    <div
      className={cx(
        styles.sadCard,
        isInactive(model.selected, Mood.Sad) && styles.inactive,
      )}
      onClick={() => actions.dispatch(Actions.Select, Mood.Sad)}
    >
      <span className={styles.emoji}>😢</span>
      <span className={styles.label}>Sad</span>
    </div>
  );
}
