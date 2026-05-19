import { route, type Routes } from "react-wayfinder";
import { utils } from "../../library/index.ts";
import { Cat } from "./components/cat/index.tsx";

export const urls = {
  cat: "/:index",
  fallback: "*",
} as const;

export const store = utils.store({
  get: (key) => localStorage.getItem(key),
  set: (key, value) => localStorage.setItem(key, value),
  remove: (key) => localStorage.removeItem(key),
});

export const routes = [
  route({
    url: urls.cat,
    match({ params }) {
      const parsed = Number(params.index);
      const index =
        Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : 0;
      return <Cat index={index} />;
    },
  }),
  route({
    url: urls.fallback,
    redirect: ({ router }) => router.url(urls.cat, { index: 0 }),
  }),
] satisfies Routes;
