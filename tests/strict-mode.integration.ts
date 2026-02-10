import { test, expect } from "@playwright/test";

test.describe("StrictMode resilience", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/test/strict-mode");
    await page.waitForSelector('[data-testid="mount-count"]');
    // Allow StrictMode double-render cycle to settle
    await page.waitForTimeout(200);
  });

  test("Lifecycle.Mount fires exactly once", async ({ page }) => {
    const mountCount = await page
      .locator('[data-testid="mount-count"]')
      .textContent();
    expect(mountCount).toBe("1");
  });

  test("annotations remain pending until resolved via produce", async ({
    page,
  }) => {
    const pending = await page.locator('[data-testid="pending"]').textContent();
    expect(pending).toBe("true");

    const name = await page.locator('[data-testid="name"]').textContent();
    expect(name).toBe("null");
  });

  test("annotations clear after produce in StrictMode", async ({ page }) => {
    await page.locator('[data-testid="set-name"]').click();
    await page.waitForTimeout(100);

    const pending = await page.locator('[data-testid="pending"]').textContent();
    expect(pending).toBe("false");

    const name = await page.locator('[data-testid="name"]').textContent();
    expect(name).toBe("Adam");
  });

  test("action handler fires exactly once per dispatch", async ({ page }) => {
    const before = await page
      .locator('[data-testid="handler-count"]')
      .textContent();
    expect(before).toBe("0");

    await page.locator('[data-testid="increment"]').click();
    await page.waitForTimeout(100);

    const after = await page
      .locator('[data-testid="handler-count"]')
      .textContent();
    expect(after).toBe("1");

    const count = await page.locator('[data-testid="count"]').textContent();
    expect(count).toBe("1");
  });

  test("multiple dispatches each fire handler exactly once", async ({
    page,
  }) => {
    await page.locator('[data-testid="increment"]').click();
    await page.waitForTimeout(50);
    await page.locator('[data-testid="increment"]').click();
    await page.waitForTimeout(50);
    await page.locator('[data-testid="increment"]').click();
    await page.waitForTimeout(50);

    const handlerCount = await page
      .locator('[data-testid="handler-count"]')
      .textContent();
    expect(handlerCount).toBe("3");

    const count = await page.locator('[data-testid="count"]').textContent();
    expect(count).toBe("3");
  });
});
