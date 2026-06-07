import type { ButtonProps } from "antd";
import { Action } from "march-hare";

export type Props = Omit<ButtonProps, "onClick" | "loading"> & {
  onClick: () => Promise<void>;
};

export type Model = {
  busy: boolean;
};

export type Data = {
  onClick: () => Promise<void>;
};

export class Actions {
  static Click = Action();
}
