import { test, expect } from "@playwright/test";

test("counter increments and decrements", async ({ page }) => {
  await page.goto("/");

  const increment = page.getByRole("button", { name: "+" });
  const decrement = page.getByRole("button", { name: "−" });
  const count = page.getByTestId("count");

  await expect(count).toHaveAttribute("data-count", "1");

  await decrement.click();
  await expect(count).toHaveAttribute("data-count", "0");

  await increment.click();
  await expect(count).toHaveAttribute("data-count", "1");

  await increment.click();
  const loading = page.getByTestId("loading");
  await expect(loading).toHaveCSS("opacity", "1");
  await expect(loading).toHaveCSS("opacity", "0");
});
