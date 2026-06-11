import type { MessageInstance } from "antd/es/message/interface";
import type * as React from "react";
import { Action, type Maybe } from "march-hare";

export type Model = {
  user: Maybe<string>;
  deleteUser: boolean;
};

export type Data = {
  messageApi: MessageInstance;
  contextHolder: () => React.ReactNode;
};

export class Actions {
  static SignIn = Action();
  static SignOut = Action();
  static DeleteUser = Action();
}
