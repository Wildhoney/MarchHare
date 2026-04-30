import { Resource } from "../../library/index.ts";
import { Actions } from "./types.ts";
import { fetchTransactions } from "./api.ts";

export const transactions = Resource(
  "transactions",
  (cursor: string | null) => fetchTransactions(cursor),
  ({ response, dispatch }) =>
    dispatch(Actions.Broadcast.TransactionsLoaded, response.items),
);
