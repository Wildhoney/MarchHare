import { expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Root } from "../example/app/index.tsx";

it("renders the Cattery page with the add-cat button", () => {
  render(<Root />);
  expect(screen.getByRole("heading", { name: "Cattery" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Add a cat" })).toBeInTheDocument();
});
