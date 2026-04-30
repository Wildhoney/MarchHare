import { Action, Distribution, Lifecycle } from "../../library/index.ts";

export type Transaction = {
  id: string;
  description: string;
  merchant: string;
  amount: number;
  currency: string;
  createdAt: string;
};

export type TransactionsPage = {
  items: Transaction[];
  nextCursor: string | null;
};

export class BroadcastActions {
  static TransactionsLoaded = Action<Transaction[]>(
    "TransactionsLoaded",
    Distribution.Broadcast,
  );
}

export type Model = {
  items: Transaction[];
  cursor: string | null;
  hasMore: boolean;
};

export class Actions {
  static Broadcast = BroadcastActions;
  static Mount = Lifecycle.Mount();

  static LoadMore = Action("LoadMore");
  static Refresh = Action("Refresh");
}
