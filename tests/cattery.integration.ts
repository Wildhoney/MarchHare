import { test, expect } from "@playwright/test";

test("adding a cat appends it to the cattery grid", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByText("No cats yet")).toBeVisible();

  await page.getByRole("button", { name: "Add a cat" }).click();

  await expect(page.getByText("No cats yet")).toBeHidden({ timeout: 10_000 });
});
