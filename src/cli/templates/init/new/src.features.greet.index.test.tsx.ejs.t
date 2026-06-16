---
to: src/features/greet/index.test.tsx
---
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { App } from "march-hare";
import { GreetButton } from "./index.tsx";
import { type Envs } from "@shared/types/index.ts";

const app = App<Envs>({ env: { apiBase: "https://api.example.test" } });

describe("GreetButton", () => {
  it("renders the Say hello button", () => {
    render(
      <app.Boundary>
        <GreetButton />
      </app.Boundary>,
    );
    expect(screen.getByRole("button", { name: "Say hello" })).toBeInTheDocument();
  });
});
