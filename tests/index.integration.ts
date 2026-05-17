import { test, expect } from "@playwright/test";

test("counter renders and refreshes the fetched user", async ({ page }) => {
  await page.goto("/");

  const user = page.getByTestId("user");
  await expect(user).toHaveText("Adam");

  const refresh = page.getByTestId("refresh");
  await refresh.click();
  await expect(user).toHaveText("Adam");
});
