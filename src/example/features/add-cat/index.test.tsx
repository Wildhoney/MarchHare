import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  render,
  screen,
  act,
  waitFor,
  fireEvent,
} from "@testing-library/react";
import { App } from "march-hare";
import { AddCatButton } from "./index.tsx";
import { type Envs } from "@example/shared/types/index.ts";

const cat = {
  id: "abc",
  url: "https://cdn.example/cat.jpg",
  width: 300,
  height: 300,
};

describe("AddCatButton", () => {
  const app = App<Envs>({ env: { apiBase: "https://api.example.test" } });

  beforeEach(() => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async () => {
      return new Response(JSON.stringify([cat]), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders an Add a cat button", () => {
    render(
      <app.Boundary>
        <AddCatButton />
      </app.Boundary>,
    );
    expect(
      screen.getByRole("button", { name: "Add a cat" }),
    ).toBeInTheDocument();
  });

  it("shows a loading state while fetching", async () => {
    let resolveFetch: (response: Response) => void = () => {};
    vi.spyOn(globalThis, "fetch").mockImplementation(
      () =>
        new Promise<Response>((resolve) => {
          resolveFetch = resolve;
        }),
    );

    render(
      <app.Boundary>
        <AddCatButton />
      </app.Boundary>,
    );

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Add a cat" }));
    });

    await waitFor(() => {
      const button = screen.getByRole("button", { name: /Add a cat/ });
      expect(button.className).toMatch(/loading/);
    });

    await act(async () => {
      resolveFetch(
        new Response(JSON.stringify([cat]), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );
    });
  });
});
