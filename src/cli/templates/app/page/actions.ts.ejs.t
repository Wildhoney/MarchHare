---
to: src/app/pages/<%= name %>/actions.ts
---
import { app } from "../../utils.ts";
import { Actions, type Model } from "./types.ts";

export function useActions() {
  const context = app.useContext<Model, typeof Actions>();
  const actions = context.useActions({ ready: false });

  actions.useAction(Actions.Ready, context.with.always("ready", true));

  return actions;
}
