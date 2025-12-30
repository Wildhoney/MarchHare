import { test, expect } from "@playwright/test";

test.describe("@use.supplant()", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/decorators");
    await page.getByTestId("clear-log").click();
  });

  /**
   * Verifies that the supplant decorator allows an action to complete normally
   * when it's not interrupted by another dispatch of the same action.
   */
  test("allows single action to complete", async ({ page }) => {
    const trigger = page.getByTestId("supplant-trigger");
    const log = page.getByTestId("action-log");

    await trigger.click();
    await expect(log).toContainText("supplant-start-", { timeout: 1000 });
    await expect(log).toContainText("supplant-end-", { timeout: 2000 });
  });

  /**
   * Verifies that rapid clicks abort previous executions, resulting in only
   * the last action completing. The supplant decorator should cancel in-flight
   * actions when a new one is dispatched. Expects 3 starts but only 1 end.
   */
  test("aborts previous action when called rapidly", async ({ page }) => {
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
    const ends = logEntries.filter((e) => e.includes("supplant-end-"));

    expect(starts.length).toBe(3);
    expect(ends.length).toBe(1);
  });
});

test.describe("@use.debounce()", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/decorators");
    await page.getByTestId("clear-log").click();
  });

  /**
   * Verifies that a single debounced action executes after the debounce
   * delay (300ms) has passed without further calls. Should not execute
   * immediately, only after the delay.
   */
  test("executes after delay when called once", async ({ page }) => {
    const trigger = page.getByTestId("debounce-trigger");
    const log = page.getByTestId("action-log");

    await trigger.click();
    await page.waitForTimeout(100);
    await expect(log).not.toContainText("debounce-executed");
    await expect(log).toContainText("debounce-executed", { timeout: 500 });
  });

  /**
   * Verifies that rapid clicks within the debounce window result in only
   * one execution. The debounce decorator resets the timer on each call,
   * so only the final debounced call executes.
   */
  test("only executes once when called rapidly", async ({ page }) => {
    const trigger = page.getByTestId("debounce-trigger");
    const log = page.getByTestId("action-log");

    await trigger.click();
    await page.waitForTimeout(100);
    await trigger.click();
    await page.waitForTimeout(100);
    await trigger.click();
    await page.waitForTimeout(500);

    const logEntries = await page.getByTestId("log-entry").allTextContents();
    const executions = logEntries.filter((e) =>
      e.includes("debounce-executed"),
    );

    expect(executions.length).toBe(1);
  });
});

test.describe("@use.throttle()", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/decorators");
    await page.getByTestId("clear-log").click();
  });

  /**
   * Verifies that the first throttled action executes immediately
   * without any delay.
   */
  test("executes immediately on first call", async ({ page }) => {
    const trigger = page.getByTestId("throttle-trigger");
    const log = page.getByTestId("action-log");

    await trigger.click();
    await expect(log).toContainText("throttle-executed-", { timeout: 100 });
  });

  /**
   * Verifies that throttle limits execution rate. Rapid clicks should result
   * in at most 2 executions: the immediate first call, plus one after the
   * 500ms throttle window expires.
   */
  test("rate limits rapid calls", async ({ page }) => {
    const trigger = page.getByTestId("throttle-trigger");
    const log = page.getByTestId("action-log");

    await trigger.click();
    await page.waitForTimeout(50);
    await trigger.click();
    await trigger.click();
    await trigger.click();
    await page.waitForTimeout(600);

    const logEntries = await page.getByTestId("log-entry").allTextContents();
    const executions = logEntries.filter((e) =>
      e.includes("throttle-executed-"),
    );

    expect(executions.length).toBe(2);
  });
});

test.describe("@use.retry()", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/decorators");
    await page.getByTestId("clear-log").click();
  });

  /**
   * Verifies that the retry decorator attempts the action multiple times
   * when it fails, eventually succeeding. The action is configured to fail
   * twice then succeed on the third attempt. Expects 3 attempts logged
   * followed by success, with the value incremented.
   */
  test("retries on failure and eventually succeeds", async ({ page }) => {
    const trigger = page.getByTestId("retry-trigger");
    const log = page.getByTestId("action-log");
    const value = page.getByTestId("retry-value");

    await trigger.click();
    await page.waitForTimeout(500);

    await expect(log).toContainText("retry-attempt-1");
    await expect(log).toContainText("retry-attempt-2");
    await expect(log).toContainText("retry-attempt-3");
    await expect(log).toContainText("retry-success");
    await expect(value).toContainText("Value: 1");
  });

  /**
   * Verifies that after a successful retry sequence, resetting the attempt
   * counter allows the retry process to work again from scratch.
   */
  test("can retry again after reset", async ({ page }) => {
    const trigger = page.getByTestId("retry-trigger");
    const reset = page.getByTestId("retry-reset");
    const log = page.getByTestId("action-log");

    await trigger.click();
    await page.waitForTimeout(500);
    await expect(log).toContainText("retry-success");

    await reset.click();
    await page.getByTestId("clear-log").click();

    await trigger.click();
    await page.waitForTimeout(500);
    await expect(log).toContainText("retry-success");
  });
});

test.describe("@use.timeout()", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/decorators");
    await page.getByTestId("clear-log").click();
  });

  /**
   * Verifies that the timeout decorator aborts an action that exceeds the
   * specified timeout duration. The action sleeps for 1000ms but timeout
   * is set to 200ms, so it should be aborted before completion. The value
   * should remain unchanged.
   */
  test("aborts action that exceeds timeout", async ({ page }) => {
    const trigger = page.getByTestId("timeout-trigger");
    const log = page.getByTestId("action-log");
    const value = page.getByTestId("timeout-value");

    await trigger.click();
    await expect(log).toContainText("timeout-start", { timeout: 100 });
    await page.waitForTimeout(500);
    await expect(log).not.toContainText("timeout-end");
    await expect(value).toContainText("Value: 0");
  });

  /**
   * Verifies that the timeout decorator triggers an antd message notification
   * when the timeout occurs, indicating the error was properly surfaced to the UI.
   */
  test("shows timeout error message", async ({ page }) => {
    const trigger = page.getByTestId("timeout-trigger");

    await trigger.click();
    await page.waitForTimeout(300);

    const notification = page.locator(".ant-message");
    await expect(notification).toBeVisible({ timeout: 1000 });
  });
});

test.describe("decorator combinations", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/decorators");
    await page.getByTestId("clear-log").click();
  });

  /**
   * Integration test to verify all decorator sections are properly loaded
   * and the test page renders correctly.
   */
  test("all decorator sections are visible", async ({ page }) => {
    await expect(page.getByTestId("supplant-section")).toBeVisible();
    await expect(page.getByTestId("debounce-section")).toBeVisible();
    await expect(page.getByTestId("throttle-section")).toBeVisible();
    await expect(page.getByTestId("retry-section")).toBeVisible();
    await expect(page.getByTestId("timeout-section")).toBeVisible();
  });

  /**
   * Verifies that the clear log functionality works correctly, which is
   * essential for running multiple tests in sequence without state pollution.
   */
  test("clear log resets state", async ({ page }) => {
    const trigger = page.getByTestId("debounce-trigger");
    const clearBtn = page.getByTestId("clear-log");
    const log = page.getByTestId("action-log");

    await trigger.click();
    await page.waitForTimeout(400);
    await expect(log).toContainText("debounce-executed");

    await clearBtn.click();
    await expect(log).toContainText("No actions logged yet");
  });
});
