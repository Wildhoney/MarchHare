import * as React from "react";
import { Button as AntButton } from "antd";
import type { Props } from "./types.ts";

export function Button(props: Props): React.ReactElement {
  return <AntButton {...props} />;
}
