import { test, expect } from "@playwright/test";

const akela = "http://localhost:8080";

test("omnicast carries adoptions and cattery resets between clients", async ({
  browser,
  request,
}) => {
  const health = await request.get(`${akela}/healthz`).catch(() => null);
  test.skip(
    health === null || !health.ok(),
    "Akela is not running on :8080 — start redis-server and the akela binary to exercise this test",
  );

  const contextA = await browser.newContext();
  const contextB = await browser.newContext();
  const pageA = await contextA.newPage();
  const pageB = await contextB.newPage();

  await pageA.goto("/");
  await pageB.goto("/");
  await expect(pageA.getByRole("button", { name: "Add a cat" })).toBeVisible();
  await expect(pageB.getByRole("button", { name: "Add a cat" })).toBeVisible();
  await pageA.waitForTimeout(500);

  await pageA.getByRole("button", { name: "Add a cat" }).click();

  await expect(pageA.locator("article p").last()).toBeVisible({
    timeout: 15_000,
  });
  const adopted = await pageA.locator("article p").last().textContent();
  expect(adopted).not.toBeNull();

  const arrival = pageB.locator("article p", { hasText: adopted ?? "" });
  await expect(arrival.first()).toBeVisible({ timeout: 15_000 });

  await pageB.getByRole("button", { name: "Open a new Cattery" }).click();

  await expect(
    pageB.locator("article p", { hasText: adopted ?? "" }),
  ).toHaveCount(0, { timeout: 15_000 });
  await expect(
    pageA.locator("article p", { hasText: adopted ?? "" }),
  ).toHaveCount(0, { timeout: 15_000 });

  await contextA.close();
  await contextB.close();
});
