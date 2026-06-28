import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { App } from "march-hare";
import { CatCard } from "./index.tsx";
import { type Envs } from "@example/shared/types/index.ts";

const app = App<Envs>({ env: { apiBase: "https://api.example.test" } });

describe("CatCard", () => {
  const cat = {
    id: "1",
    name: "Whiskers",
    avatar: "https://cdn.example/whiskers.jpg",
    filter: "filter-clarendon",
  } as const;

  it("renders the cat's name", () => {
    render(
      <app.Boundary>
        <CatCard cat={cat} />
      </app.Boundary>,
    );
    expect(screen.getByText("Whiskers")).toBeInTheDocument();
  });

  it("renders the avatar with src and alt attributes", () => {
    render(
      <app.Boundary>
        <CatCard cat={cat} />
      </app.Boundary>,
    );
    const img = screen.getByAltText("Whiskers");
    expect(img).toHaveAttribute("src", cat.avatar);
  });
});
