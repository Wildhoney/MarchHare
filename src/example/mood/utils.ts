import { Mood } from "./types.ts";

export function isInactive(selected: Mood | null, mood: Mood): boolean {
  return selected !== null && selected !== mood;
}
