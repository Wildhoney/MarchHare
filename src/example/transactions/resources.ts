import { Resource } from "march-hare";
import { fetchTransactions } from "./api.ts";
import type { TransactionsPage } from "./types.ts";

export const transactions = Resource<
  TransactionsPage,
  { cursor: string | null }
>(({ controller, params }) =>
  fetchTransactions(params.cursor, controller.signal),
);
