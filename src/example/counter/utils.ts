import { Resource } from "../../library";
import { User } from "./types";

export const resources = {
  user: Resource(async (): Promise<User> => {
    return { name: "Adam", age: 30 };
  }),
};
