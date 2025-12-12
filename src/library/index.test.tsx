import { expect, it, jest, beforeEach, afterEach } from "@jest/globals";
import { render, screen, fireEvent, act } from "@testing-library/react";
import Counter from "../example/counter";

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

it("should increment and decrement the counter", async () => {
  render(<Counter />);

  expect(screen.getByLabelText("1")).toBeTruthy();

  fireEvent.click(screen.getByText("+"));
  await act(async () => {
    jest.advanceTimersByTime(1_000);
  });
  expect(await screen.findByLabelText("2")).toBeTruthy();

  fireEvent.click(screen.getByText("−"));
  expect(await screen.findByLabelText("1")).toBeTruthy();

  fireEvent.click(screen.getByText("−"));
  expect(await screen.findByLabelText("0")).toBeTruthy();

  fireEvent.click(screen.getByText("−"));
  expect(await screen.findByLabelText("-1")).toBeTruthy();
});
