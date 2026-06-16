---
to: src/app/pages/<%= name %>/index.integration.tsx
---
import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { Root } from "@app/index.tsx";

describe("<%= pascalName %>Page (integration)", () => {
  it("mounts inside the app boundary without crashing", () => {
    render(<Root />);
    expect(document.body).toBeInTheDocument();
  });
});
