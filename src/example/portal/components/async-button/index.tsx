import * as React from "react";
import { Button } from "antd";
import { useActions } from "./actions.ts";
import { Actions } from "./types.ts";
import type { Props } from "./types.ts";

export function AsyncButton({
  onClick,
  children,
  disabled,
  ...rest
}: Props): React.ReactElement {
  const [model, actions] = useActions({ onClick });

  return (
    <Button
      {...rest}
      loading={model.busy}
      disabled={disabled || model.busy}
      onClick={() => actions.dispatch(Actions.Click)}
    >
      {children}
    </Button>
  );
}
