import * as React from "react";
import { useActions } from "./actions.ts";
import { Actions } from "./types.ts";
import { Mood } from "../../types.ts";
import { isInactive } from "../../utils.ts";
import * as styles from "../../styles.ts";
import { cx } from "@emotion/css";

export default function Happy(): React.ReactElement {
  const [model, actions] = useActions();

  return (
    <div
      className={cx(
        styles.happyCard,
        isInactive(model.selected, Mood.Happy) && styles.inactive,
      )}
      onClick={() => actions.dispatch(Actions.Select, Mood.Happy)}
    >
      <span className={styles.emoji}>😊</span>
      <span className={styles.label}>Happy</span>
    </div>
  );
}
