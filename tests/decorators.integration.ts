import { test, expect } from "@playwright/test";

test.describe("Async actions", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/decorators");
    await page.getByTestId("clear-log").click();
  });

  /**
   * Verifies that an async action completes normally when triggered once.
   */
  test("allows single action to complete", async ({ page }) => {
    const trigger = page.getByTestId("supplant-trigger");
    const log = page.getByTestId("action-log");

    await trigger.click();
    await expect(log).toContainText("supplant-start-", { timeout: 1000 });
    await expect(log).toContainText("supplant-end-", { timeout: 2000 });
  });

  /**
   * Verifies that multiple rapid clicks all start their actions.
   * Without decorators, all actions will attempt to complete.
   */
  test("executes all actions when called rapidly", async ({ page }) => {
    const trigger = page.getByTestId("supplant-trigger");
    const log = page.getByTestId("action-log");

    await trigger.click();
    await page.waitForTimeout(100);
    await trigger.click();
    await page.waitForTimeout(100);
    await trigger.click();
    await page.waitForTimeout(700);

    const logEntries = await page.getByTestId("log-entry").allTextContents();
    const starts = logEntries.filter((e) => e.includes("supplant-start-"));

    expect(starts.length).toBe(3);
  });
});

test.describe("Immediate actions", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/decorators");
    await page.getByTestId("clear-log").click();
  });

  /**
   * Verifies that an immediate action executes right away.
   */
  test("executes immediately when called", async ({ page }) => {
    const trigger = page.getByTestId("debounce-trigger");
    const log = page.getByTestId("action-log");

    await trigger.click();
    await expect(log).toContainText("debounce-executed", { timeout: 100 });
  });

  /**
   * Verifies that rapid clicks each trigger an execution.
   * Without debouncing, all clicks execute.
   */
  test("executes each time when called rapidly", async ({ page }) => {
    const trigger = page.getByTestId("debounce-trigger");

    await trigger.click();
    await page.waitForTimeout(50);
    await trigger.click();
    await page.waitForTimeout(50);
    await trigger.click();
    await page.waitForTimeout(100);

    const logEntries = await page.getByTestId("log-entry").allTextContents();
    const executions = logEntries.filter((e) =>
      e.includes("debounce-executed"),
    );

    expect(executions.length).toBe(3);
  });
});

test.describe("Throttle-like actions", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/decorators");
    await page.getByTestId("clear-log").click();
  });

  /**
   * Verifies that the action executes immediately on first call.
   */
  test("executes immediately on first call", async ({ page }) => {
    const trigger = page.getByTestId("throttle-trigger");
    const log = page.getByTestId("action-log");

    await trigger.click();
    await expect(log).toContainText("throttle-executed-", { timeout: 100 });
  });

  /**
   * Verifies that all rapid calls execute without rate limiting.
   * Without throttling, all calls execute.
   */
  test("executes all rapid calls", async ({ page }) => {
    const trigger = page.getByTestId("throttle-trigger");

    await trigger.click();
    await page.waitForTimeout(50);
    await trigger.click();
    await trigger.click();
    await trigger.click();
    await page.waitForTimeout(100);

    const logEntries = await page.getByTestId("log-entry").allTextContents();
    const executions = logEntries.filter((e) =>
      e.includes("throttle-executed-"),
    );

    expect(executions.length).toBe(4);
  });
});

test.describe("Error handling actions", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/decorators");
    await page.getByTestId("clear-log").click();
  });

  /**
   * Verifies that an action can fail and log the attempt.
   * Without automatic retry, only one attempt is made per click.
   */
  test("logs attempt on failure", async ({ page }) => {
    const trigger = page.getByTestId("retry-trigger");
    const log = page.getByTestId("action-log");

    await trigger.click();
    await page.waitForTimeout(100);

    await expect(log).toContainText("retry-attempt-1");
  });

  /**
   * Verifies that clicking multiple times increments the attempt counter.
   * Third attempt succeeds.
   */
  test("succeeds on third manual attempt", async ({ page }) => {
    const trigger = page.getByTestId("retry-trigger");
    const log = page.getByTestId("action-log");
    const value = page.getByTestId("retry-value");

    // First attempt fails
    await trigger.click();
    await page.waitForTimeout(100);
    await expect(log).toContainText("retry-attempt-1");

    // Second attempt fails
    await trigger.click();
    await page.waitForTimeout(100);
    await expect(log).toContainText("retry-attempt-2");

    // Third attempt succeeds
    await trigger.click();
    await page.waitForTimeout(100);
    await expect(log).toContainText("retry-attempt-3");
    await expect(log).toContainText("retry-success");
    await expect(value).toContainText("Value: 1");
  });

  /**
   * Verifies that resetting allows the counter to start over.
   */
  test("can retry again after reset", async ({ page }) => {
    const trigger = page.getByTestId("retry-trigger");
    const reset = page.getByTestId("retry-reset");
    const log = page.getByTestId("action-log");

    // Click three times to succeed
    await trigger.click();
    await page.waitForTimeout(50);
    await trigger.click();
    await page.waitForTimeout(50);
    await trigger.click();
    await page.waitForTimeout(100);
    await expect(log).toContainText("retry-success");

    await reset.click();
    await page.getByTestId("clear-log").click();

    // After reset, first click should be attempt 1 again
    await trigger.click();
    await page.waitForTimeout(100);
    await expect(log).toContainText("retry-attempt-1");
  });
});

test.describe("Long running actions", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/decorators");
    await page.getByTestId("clear-log").click();
  });

  /**
   * Verifies that a long-running action starts execution.
   */
  test("starts long action", async ({ page }) => {
    const trigger = page.getByTestId("timeout-trigger");
    const log = page.getByTestId("action-log");

    await trigger.click();
    await expect(log).toContainText("timeout-start", { timeout: 100 });
  });

  /**
   * Verifies that a long-running action completes after its duration.
   * Without timeout decorator, action completes normally.
   */
  test("completes after full duration", async ({ page }) => {
    const trigger = page.getByTestId("timeout-trigger");
    const log = page.getByTestId("action-log");
    const value = page.getByTestId("timeout-value");

    await trigger.click();
    await expect(log).toContainText("timeout-start", { timeout: 100 });
    await page.waitForTimeout(1200);
    await expect(log).toContainText("timeout-end");
    await expect(value).toContainText("Value: 1");
  });
});

test.describe("Action control patterns", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/decorators");
    await page.getByTestId("clear-log").click();
  });

  /**
   * Integration test to verify all sections are properly loaded.
   */
  test("all sections are visible", async ({ page }) => {
    await expect(page.getByTestId("supplant-section")).toBeVisible();
    await expect(page.getByTestId("debounce-section")).toBeVisible();
    await expect(page.getByTestId("throttle-section")).toBeVisible();
    await expect(page.getByTestId("retry-section")).toBeVisible();
    await expect(page.getByTestId("timeout-section")).toBeVisible();
  });

  /**
   * Verifies that the clear log functionality works correctly.
   */
  test("clear log resets state", async ({ page }) => {
    const trigger = page.getByTestId("debounce-trigger");
    const clearBtn = page.getByTestId("clear-log");
    const log = page.getByTestId("action-log");

    await trigger.click();
    await page.waitForTimeout(100);
    await expect(log).toContainText("debounce-executed");

    await clearBtn.click();
    await expect(log).toContainText("No actions logged yet");
  });
});
