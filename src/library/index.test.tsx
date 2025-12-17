import { expect, it } from "@jest/globals";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import Counter from "../example/counter";

it("should decrement the counter synchronously", async () => {
  render(<Counter />);

  expect(screen.getByLabelText("1")).toBeTruthy();

  fireEvent.click(screen.getByText("−"));
  await waitFor(() => {
    expect(screen.getByLabelText("0")).toBeTruthy();
  });

  fireEvent.click(screen.getByText("−"));
  await waitFor(() => {
    expect(screen.getByLabelText("-1")).toBeTruthy();
  });
});
