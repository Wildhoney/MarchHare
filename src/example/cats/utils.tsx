import { route, type Routes } from "react-wayfinder";
import { Cat } from "./components/cat/index.tsx";

export const urls = {
  cat: "/:index",
  fallback: "*",
} as const;

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
