import { test, expect } from "@playwright/test";

test("adding a cat appends it to the cattery grid", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("button", { name: "Add a cat" })).toBeVisible();
  const before = await page.locator("article").count();

  await page.getByRole("button", { name: "Add a cat" }).click();

  await expect(page.locator("article").nth(before)).toBeVisible({
    timeout: 10_000,
  });
});
