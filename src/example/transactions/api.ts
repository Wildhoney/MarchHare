import type { Transaction, TransactionsPage } from "./types.ts";

// Mock paginated API — returns 20 transactions per page across 5 pages
// total, with simulated latency. The cursor is a string-encoded page index.

const MERCHANTS = [
  "Whole Foods",
  "Tesco",
  "Pret a Manger",
  "Apple",
  "Spotify",
  "British Airways",
  "Uber",
  "Deliveroo",
  "Marks & Spencer",
  "John Lewis",
  "Amazon",
  "Netflix",
  "TFL",
  "Boots",
  "Sainsbury's",
];

const DESCRIPTIONS = [
  "Weekly shop",
  "Coffee and pastry",
  "Subscription renewal",
  "Flight to Edinburgh",
  "Ride home",
  "Late dinner",
  "New headphones",
  "Tube fare",
  "Birthday gift",
  "Office supplies",
];

const PAGE_SIZE = 20;
const TOTAL_PAGES = 5;

function seededRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function buildPage(pageIndex: number): TransactionsPage {
  const rand = seededRandom(pageIndex * 1000 + 7);
  const items: Transaction[] = [];
  for (let i = 0; i < PAGE_SIZE; i += 1) {
    const merchant = MERCHANTS[Math.floor(rand() * MERCHANTS.length)];
    const description = DESCRIPTIONS[Math.floor(rand() * DESCRIPTIONS.length)];
    const amount = Math.round(rand() * 25000) / 100;
    const daysAgo = pageIndex * PAGE_SIZE + i;
    const createdAt = new Date(
      Date.now() - daysAgo * 1000 * 60 * 60 * 6,
    ).toISOString();
    items.push({
      id: `tx_${pageIndex}_${i}`,
      description,
      merchant,
      amount,
      currency: "GBP",
      createdAt,
    });
  }
  const nextCursor = pageIndex + 1 < TOTAL_PAGES ? String(pageIndex + 1) : null;
  return { items, nextCursor };
}

export async function fetchTransactions(
  cursor: string | null,
): Promise<TransactionsPage> {
  // Simulate network latency
  await new Promise((resolve) => setTimeout(resolve, 600));
  const pageIndex = cursor === null ? 0 : Number(cursor);
  return buildPage(pageIndex);
}
