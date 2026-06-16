---
to: src/features/<%= name %>/index.test.tsx
---
import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { App } from "march-hare";
import { <%= pascalName %> } from "./index.tsx";
import { type Envs } from "@shared/types/index.ts";

const app = App<Envs>({ env: { apiBase: "https://api.example.test" } });

describe("<%= pascalName %>", () => {
  it("renders inside an app boundary", () => {
    render(
      <app.Boundary>
        <<%= pascalName %> />
      </app.Boundary>,
    );
    expect(document.body).toBeInTheDocument();
  });
});
