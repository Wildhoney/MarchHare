import { app } from "../app.ts";
import { User } from "./types";

export const user = app.Resource<User>(async () => {
  return { name: "Adam", age: 30 };
});
