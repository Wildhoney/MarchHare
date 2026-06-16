---
to: src/shared/components/<%= name %>/index.test.tsx
---
import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { <%= pascalName %> } from "./index.tsx";

describe("<%= pascalName %>", () => {
  it("renders without crashing", () => {
    render(<<%= pascalName %> />);
    expect(document.body).toBeInTheDocument();
  });
});
