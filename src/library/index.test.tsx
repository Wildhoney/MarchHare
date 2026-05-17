import { expect, it } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { Boundary } from "./index.ts";
import Counter from "../example/counter";

it("renders the fetched user", async () => {
  render(
    <Boundary>
      <Counter />
    </Boundary>,
  );
  await waitFor(() =>
    expect(screen.getByTestId("user").textContent).toBe("Adam"),
  );
});
