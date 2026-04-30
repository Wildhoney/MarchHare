import { Resource } from "../../library/index.ts";
import { Actions } from "./types.ts";
import { fetchCat } from "./api.ts";

// One Resource for the cats endpoint. The `index` arg keys the in-flight
// dedup &mdash; concurrent calls for the same index share a request,
// while different indexes run independently. The fetcher itself ignores
// the arg (the Cat API returns a random cat regardless), but the arg
// still drives the per-index fetch lifecycle.
export const cat = Resource(
  "cat",
  (_index: number) => fetchCat(),
  ({ response, dispatch }) =>
    dispatch(Actions.Broadcast.CatViewed, response.id),
);
