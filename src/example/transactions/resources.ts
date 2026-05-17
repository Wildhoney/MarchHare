import { Resource } from "../../library/index.ts";
import { fetchTransactions } from "./api.ts";
import type { TransactionsPage } from "./types.ts";

export const transactions = Resource<
  TransactionsPage,
  { cursor: string | null }
>(({ cursor }) => fetchTransactions(cursor));
