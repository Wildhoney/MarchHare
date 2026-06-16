---
to: tests/home.e2e.ts
---
import { test, expect } from "@playwright/test";

test("clicking Say hello renders a greeting", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByText(/No greeting yet/)).toBeVisible();

  await page.getByRole("button", { name: /Say hello/ }).click();

  await expect(page.getByText(/Hello from/)).toBeVisible();
});
