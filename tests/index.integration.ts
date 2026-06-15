import { test, expect } from "@playwright/test";

test("cattery renders heading and add-cat button", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Cattery" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Add a cat" })).toBeVisible();
});
