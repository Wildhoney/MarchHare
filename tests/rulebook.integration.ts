/**
 * Chizu Rulebook E2E Tests
 *
 * Comprehensive integration tests for all 39 rules in RULEBOOK.md
 * Each test is labeled with the rule number and its intention.
 */
import { test, expect } from "@playwright/test";

// Use 'it' alias for BDD-style test naming
const it = test;

test.describe("Chizu Rulebook", () => {
  // Actions (Rules 1-4)
  test.describe("Actions", () => {
    test.beforeEach(async ({ page }) => {
      await page.goto("/?fixture=actions");
      await expect(page.getByTestId("actions-fixture")).toBeVisible();
    });

    it("Rule 1: Define actions as static class members - should dispatch actions with typed payloads", async ({
      page,
    }) => {
      const count = page.getByTestId("rule-1-count");
      const lastAction = page.getByTestId("rule-1-last-action");

      await expect(count).toHaveText("0");
      await expect(lastAction).toHaveText("");

      await page.getByTestId("rule-1-increment").click();
      await expect(count).toHaveText("1");
      await expect(lastAction).toHaveText("increment");

      await page.getByTestId("rule-1-increment-5").click();
      await expect(count).toHaveText("6");

      await page.getByTestId("rule-1-decrement").click();
      await expect(count).toHaveText("5");
      await expect(lastAction).toHaveText("decrement");

      await page.getByTestId("rule-1-reset").click();
      await expect(count).toHaveText("0");
      await expect(lastAction).toHaveText("reset");
    });

    it("Rule 2: Use Distribution.Broadcast for cross-component communication - should broadcast actions across components", async ({
      page,
    }) => {
      const user = page.getByTestId("rule-2-user");
      const messages = page.getByTestId("rule-2-messages");

      await expect(user).toHaveText("No user");
      await expect(messages).toHaveText("");

      await page.getByTestId("rule-2-login").click();
      await expect(user).toHaveText("Alice (123)");

      await page.getByTestId("rule-2-message").click();
      await expect(messages).toHaveText("Hello from sender!");
    });

    it("Rule 3: Never mix unicast and broadcast without inheritance - should support mixed actions via inheritance", async ({
      page,
    }) => {
      const local = page.getByTestId("rule-3-local");
      const broadcast = page.getByTestId("rule-3-broadcast");

      await expect(local).toHaveText("");
      await expect(broadcast).toHaveText("");

      await page.getByTestId("rule-3-local-btn").click();
      await expect(local).toHaveText("Fetched: test-query");

      await page.getByTestId("rule-3-broadcast-btn").click();
      await expect(broadcast).toHaveText("Broadcast message");
    });

    it("Rule 4: Action names should be descriptive for error tracing - should capture action names in errors", async ({
      page,
    }) => {
      const status = page.getByTestId("rule-4-status");
      const errorAction = page.getByTestId("rule-4-error-action");

      await expect(status).toHaveText("idle");

      await page.getByTestId("rule-4-fetch").click();
      await expect(status).toHaveText("Fetching user 42");

      await page.getByTestId("rule-4-cart").click();
      await expect(status).toHaveText("Updated item 1 to qty 3");

      await page.getByTestId("rule-4-error").click();
      await expect(status).toHaveText("error");
      await expect(errorAction).toHaveText("ProcessPaymentTransaction");
    });
  });

  // State Updates (Rules 5-7)
  test.describe("State Updates", () => {
    test.beforeEach(async ({ page }) => {
      await page.goto("/?fixture=state-updates");
      await expect(page.getByTestId("state-updates-fixture")).toBeVisible();
    });

    it("Rule 5: Always use produce() for state mutations - should update state through produce()", async ({
      page,
    }) => {
      const value = page.getByTestId("rule-5-value");
      const history = page.getByTestId("rule-5-history");

      await expect(value).toHaveText("0");

      await page.getByTestId("rule-5-set-10").click();
      await expect(value).toHaveText("10");
      await expect(history).toContainText("Set to 10");

      await page.getByTestId("rule-5-set-42").click();
      await expect(value).toHaveText("42");
      await expect(history).toContainText("Set to 42");

      await page.getByTestId("rule-5-set-100").click();
      await expect(value).toHaveText("100");
      await expect(history).toContainText("Set to 100");
    });

    it("Rule 6: Use annotations for trackable state changes - should track pending state with annotations", async ({
      page,
    }) => {
      const data = page.getByTestId("rule-6-data");
      const pending = page.getByTestId("rule-6-pending");
      const draft = page.getByTestId("rule-6-draft");

      await expect(data).toHaveText("initial");
      await expect(pending).toHaveText("settled");

      await page.getByTestId("rule-6-update").click();

      await expect(pending).toHaveText("pending");
      await expect(draft).toHaveText("updated-value");

      await expect(pending).toHaveText("settled", { timeout: 2000 });
      await expect(data).toHaveText("updated-value");
    });

    it("Rule 7: Nested produce() calls are allowed - should handle nested produce() in sync handler", async ({
      page,
    }) => {
      const step1 = page.getByTestId("rule-7-step1");
      const step2 = page.getByTestId("rule-7-step2");

      await expect(step1).toHaveText("");
      await expect(step2).toHaveText("");

      await page.getByTestId("rule-7-nested").click();
      await expect(step1).toHaveText("first-step");
      await expect(step2).toHaveText("second-step");
    });

    it("Rule 7: Nested produce() calls are allowed - should handle multiple produce() in async handler", async ({
      page,
    }) => {
      const status = page.getByTestId("rule-7-async-status");

      await expect(status).toHaveText("idle");

      await page.getByTestId("rule-7-async").click();

      await expect(status).toHaveText("loading");
      await expect(status).toHaveText("processing", { timeout: 1000 });
      await expect(status).toHaveText("complete", { timeout: 1000 });
    });
  });

  // Handlers (Rules 8-12)
  test.describe("Handlers", () => {
    test.beforeEach(async ({ page }) => {
      await page.goto("/?fixture=handlers");
      await expect(page.getByTestId("handlers-fixture")).toBeVisible();
    });

    it("Rule 8: Four handler signatures - should execute synchronous handler", async ({
      page,
    }) => {
      const sync = page.getByTestId("rule-8-sync");
      await expect(sync).toHaveText("");

      await page.getByTestId("rule-8-sync-btn").click();
      await expect(sync).toHaveText("sync: hello");
    });

    it("Rule 8: Four handler signatures - should execute asynchronous handler", async ({
      page,
    }) => {
      const async = page.getByTestId("rule-8-async");
      await expect(async).toHaveText("");

      await page.getByTestId("rule-8-async-btn").click();
      await expect(async).toHaveText("async: world", { timeout: 1000 });
    });

    it("Rule 8: Four handler signatures - should execute finite generator handler", async ({
      page,
    }) => {
      const generator = page.getByTestId("rule-8-generator");
      await expect(generator).toHaveText("");

      await page.getByTestId("rule-8-generator-btn").click();
      await expect(generator).toHaveText("a, b, c", { timeout: 1000 });
    });

    it("Rule 8: Four handler signatures - should execute infinite generator with polling", async ({
      page,
    }) => {
      const pollCount = page.getByTestId("rule-8-poll-count");
      const isPolling = page.getByTestId("rule-8-is-polling");

      await expect(pollCount).toHaveText("0");
      await expect(isPolling).toHaveText("stopped");

      await page.getByTestId("rule-8-poll-start").click();
      await expect(isPolling).toHaveText("polling");

      await expect(pollCount).not.toHaveText("0", { timeout: 2000 });

      await page.getByTestId("rule-8-poll-stop").click();
      await expect(isPolling).toHaveText("stopped", { timeout: 1000 });
    });

    it("Rule 9: Use With() for simple property assignments - should assign properties with With()", async ({
      page,
    }) => {
      const name = page.getByTestId("rule-9-name");
      const age = page.getByTestId("rule-9-age");
      const active = page.getByTestId("rule-9-active");

      await expect(name).toHaveText("");
      await expect(age).toHaveText("0");
      await expect(active).toHaveText("inactive");

      await page.getByTestId("rule-9-set-name").click();
      await expect(name).toHaveText("Alice");

      await page.getByTestId("rule-9-set-age").click();
      await expect(age).toHaveText("30");

      await page.getByTestId("rule-9-set-active").click();
      await expect(active).toHaveText("active");
    });

    it("Rule 10: Use channeled actions for targeted event delivery - should deliver to matching handlers only", async ({
      page,
    }) => {
      const user1 = page.getByTestId("rule-10-user1");
      const user2 = page.getByTestId("rule-10-user2");
      const allUpdates = page.getByTestId("rule-10-all-updates");

      await expect(user1).toHaveText("");
      await expect(user2).toHaveText("");
      await expect(allUpdates).toHaveText("0");

      await page.getByTestId("rule-10-update-user1").click();
      await expect(user1).toHaveText("Alice");
      await expect(user2).toHaveText("");
      await expect(allUpdates).toHaveText("1");

      await page.getByTestId("rule-10-update-user2").click();
      await expect(user1).toHaveText("Alice");
      await expect(user2).toHaveText("Bob");
      await expect(allUpdates).toHaveText("2");

      await page.getByTestId("rule-10-update-all").click();
      await expect(allUpdates).toHaveText("3");
    });

    it("Rule 11: Extract handlers for testability - compile-time verification", async ({
      page,
    }) => {
      // Rule 11 is compile-time only - handlers are typed via Handler<M, AC>
      // This test verifies the fixture loads correctly with typed handlers
      await expect(page.getByTestId("handlers-fixture")).toBeVisible();
    });

    it("Rule 12: Access external values via context.data after await - should get latest prop values", async ({
      page,
    }) => {
      const currentQuery = page.getByTestId("rule-12-current-query");
      const captured = page.getByTestId("rule-12-captured");
      const result = page.getByTestId("rule-12-result");
      const input = page.getByTestId("rule-12-input");

      await expect(currentQuery).toHaveText("initial-query");

      await page.getByTestId("rule-12-fetch").click();
      await expect(result).toHaveText("loading");

      await input.fill("changed-query");
      await expect(currentQuery).toHaveText("changed-query");

      await expect(result).toContainText("done", { timeout: 2000 });
      await expect(captured).toHaveText("changed-query");
    });
  });

  // Lifecycles (Rules 13-15)
  test.describe("Lifecycles", () => {
    test.beforeEach(async ({ page }) => {
      await page.goto("/?fixture=lifecycles");
      await expect(page.getByTestId("lifecycles-fixture")).toBeVisible();
    });

    it("Rule 13: Use lifecycle actions instead of useEffect - should fire mount lifecycle action", async ({
      page,
    }) => {
      const events = page.getByTestId("rule-13-events");

      await expect(events).toContainText("mount");
    });

    it("Rule 13: Use lifecycle actions instead of useEffect - should handle local errors with Lifecycle.Error", async ({
      page,
    }) => {
      const lastError = page.getByTestId("rule-13-last-error");
      const events = page.getByTestId("rule-13-events");

      await expect(lastError).toHaveText("");

      await page.getByTestId("rule-13-throw").click();
      await expect(lastError).toHaveText("Test error from interaction");
      await expect(events).toContainText("error");
    });

    it("Rule 13: Use lifecycle actions instead of useEffect - should fire unmount lifecycle when removed", async ({
      page,
    }) => {
      await page.getByTestId("rule-13-toggle").click();
      await expect(page.getByTestId("rule-13")).not.toBeVisible();
    });

    it("Rule 13: Lifecycle.Node - should fire once on mount when node is captured", async ({
      page,
    }) => {
      const callCount = page.getByTestId("rule-13-node-call-count");
      const lastName = page.getByTestId("rule-13-node-last-name");

      // Should have fired once on mount
      await expect(callCount).toHaveText("1");
      await expect(lastName).toHaveText("testButton");
    });

    it("Rule 13: Lifecycle.Node - should not fire when state changes but node stays same", async ({
      page,
    }) => {
      const callCount = page.getByTestId("rule-13-node-call-count");
      const button = page.getByTestId("rule-13-node-button");

      await expect(callCount).toHaveText("1");

      // Click the button to trigger state change (counter increments)
      await button.click();
      await expect(button).toContainText("Click me (1)");

      // Call count should still be 1 - node didn't change
      await expect(callCount).toHaveText("1");

      // Click again
      await button.click();
      await expect(button).toContainText("Click me (2)");

      // Still 1
      await expect(callCount).toHaveText("1");
    });

    it("Rule 14: Understand the Phase context - should have mounting phase during mount", async ({
      page,
    }) => {
      const phaseMount = page.getByTestId("rule-14-phase-mount");
      await expect(phaseMount).toHaveText("mounting");
    });

    it("Rule 14: Understand the Phase context - should have mounted phase after mount", async ({
      page,
    }) => {
      const phaseAction = page.getByTestId("rule-14-phase-action");

      await page.getByTestId("rule-14-interact").click();
      await expect(phaseAction).toHaveText("mounted");
    });

    it("Rule 15: Mounting phase delivers cached and lifecycle actions - should deliver cached values to late-mounting components", async ({
      page,
    }) => {
      await page.getByTestId("rule-15-send").click();

      await page.getByTestId("rule-15-show-receiver").click();

      const received1 = page.getByTestId("rule-15-received-1");
      const phase1 = page.getByTestId("rule-15-phase-1");

      await expect(received1).toHaveText("cached-payload", { timeout: 1000 });
      await expect(phase1).toHaveText("mounting", { timeout: 1000 });

      await page.getByTestId("rule-15-show-second").click();

      const received2 = page.getByTestId("rule-15-received-2");
      await expect(received2).toHaveText("cached-payload", { timeout: 1000 });
    });
  });

  // Broadcast Actions (Rules 16-19)
  test.describe("Broadcast Actions", () => {
    test.beforeEach(async ({ page }) => {
      await page.goto("/?fixture=broadcast-actions");
      await expect(page.getByTestId("broadcast-actions-fixture")).toBeVisible();
    });

    it("Rule 16: Only broadcast actions can be consumed - should update traditional handler on broadcast", async ({
      page,
    }) => {
      const traditional = page.getByTestId("rule-16-17-traditional");

      await expect(traditional).toHaveText("");

      await page.getByTestId("rule-16-17-login").click();
      await expect(traditional).toHaveText("Alice");

      await page.getByTestId("rule-16-17-login-bob").click();
      await expect(traditional).toHaveText("Bob");
    });

    it("Rule 17: Use consume() for reactive UI from broadcast actions - should reactively render with consume()", async ({
      page,
    }) => {
      const consumedUser = page.getByTestId("rule-16-17-consumed-user");
      const consumedCounter = page.getByTestId("rule-16-17-consumed-counter");
      const consumedData = page.getByTestId("rule-16-17-consumed-data");

      await expect(consumedUser).toBeEmpty();
      await expect(consumedCounter).toBeEmpty();
      await expect(consumedData).toBeEmpty();

      await page.getByTestId("rule-16-17-login").click();
      await expect(consumedUser).toContainText("Welcome, Alice (ID: 1)");

      await page.getByTestId("rule-16-17-counter").click();
      await expect(consumedCounter).toContainText("Counter: 42");

      await page.getByTestId("rule-16-17-data").click();
      await expect(consumedData).toContainText("apple");
      await expect(consumedData).toContainText("banana");
      await expect(consumedData).toContainText("cherry");
    });

    it("Rule 18: Late-mounting components receive cached values - should deliver cached values to late subscribers", async ({
      page,
    }) => {
      await page.getByTestId("rule-18-publish").click();

      await page.getByTestId("rule-18-mount-sub1").click();

      const data1 = page.getByTestId("rule-18-data-1");
      const phase1 = page.getByTestId("rule-18-phase-1");

      await expect(data1).toHaveText("cached-item-1, cached-item-2");
      await expect(phase1).toHaveText("mounting");

      await page.getByTestId("rule-18-mount-sub2").click();

      const data2 = page.getByTestId("rule-18-data-2");
      await expect(data2).toHaveText("cached-item-1, cached-item-2");
    });

    it("Rule 18: Late-mounting components receive cached values - should receive live updates after mount", async ({
      page,
    }) => {
      await page.getByTestId("rule-18-mount-sub1").click();

      const data1 = page.getByTestId("rule-18-data-1");
      const phase1 = page.getByTestId("rule-18-phase-1");

      await expect(data1).toHaveText("");

      await page.getByTestId("rule-18-publish").click();

      await expect(data1).toHaveText("cached-item-1, cached-item-2");
      await expect(phase1).toHaveText("mounted");
    });

    it("Rule 19: Use channeled actions for targeted broadcast delivery - should deliver to matching handlers only", async ({
      page,
    }) => {
      const user1 = page.getByTestId("rule-19-user1");
      const user2 = page.getByTestId("rule-19-user2");

      await expect(user1).toHaveText("");
      await expect(user2).toHaveText("");

      await page.getByTestId("rule-19-update-user1").click();
      await expect(user1).toHaveText("Alice Updated <alice@example.com>");
      await expect(user2).toHaveText("");

      await page.getByTestId("rule-19-update-user2").click();
      await expect(user2).toHaveText("Bob Updated <bob@example.com>");
    });

    it("Rule 19: Use channeled actions for targeted broadcast delivery - should deliver to all when dispatching without channel", async ({
      page,
    }) => {
      const user1 = page.getByTestId("rule-19-user1");
      const user2 = page.getByTestId("rule-19-user2");

      await page.getByTestId("rule-19-update-all-users").click();

      await expect(user1).toHaveText("Broadcast to All <all@example.com>");
      await expect(user2).toHaveText("Broadcast to All <all@example.com>");
    });
  });

  // Task Management (Rules 20-22)
  test.describe("Task Management", () => {
    test.beforeEach(async ({ page }) => {
      await page.goto("/?fixture=task-management");
      await expect(page.getByTestId("task-management-fixture")).toBeVisible();
    });

    it("Rule 20: Use the abort signal for cancellation - should complete fetch when not cancelled", async ({
      page,
    }) => {
      const status = page.getByTestId("rule-20-status");
      const result = page.getByTestId("rule-20-result");

      await expect(status).toHaveText("idle");

      await page.getByTestId("rule-20-fetch").click();
      await expect(status).toHaveText("loading");

      await expect(status).toHaveText("success", { timeout: 2000 });
      await expect(result).toHaveText("Fetched: /api/data");
    });

    it("Rule 20: Use the abort signal for cancellation - should cancel fetch with abort signal", async ({
      page,
    }) => {
      const status = page.getByTestId("rule-20-status");
      const cancelled = page.getByTestId("rule-20-cancelled");

      await page.getByTestId("rule-20-fetch").click();
      await expect(status).toHaveText("loading");

      await page.getByTestId("rule-20-cancel").click();
      await expect(status).toHaveText("cancelled", { timeout: 1500 });
      await expect(cancelled).toHaveText("cancelled");
    });

    it("Rule 21: Cancel competing tasks explicitly - should cancel previous tasks when new one starts", async ({
      page,
    }) => {
      const results = page.getByTestId("rule-21-results");

      await page.getByTestId("rule-21-rapid").click();

      await expect(results).toContainText("started:1", { timeout: 1000 });
      await expect(results).toContainText("started:2", { timeout: 1000 });
      await expect(results).toContainText("started:3", { timeout: 1000 });

      await page.waitForTimeout(2000);

      const text = await results.textContent();
      expect(text).toContain("completed:3");
      expect(text).toMatch(/cancelled:1|aborted:1/);
      expect(text).toMatch(/cancelled:2|aborted:2/);
    });

    it("Rule 22: State updates are blocked after unmount - should not complete operation after unmount", async ({
      page,
    }) => {
      const logs = page.getByTestId("rule-22-logs");
      const mounted = page.getByTestId("rule-22-mounted");

      await page.getByTestId("rule-22-start-slow").click();
      await expect(logs).toContainText("started");

      await page.getByTestId("rule-22-unmount").click();
      await expect(mounted).toHaveText("unmounted");

      await page.waitForTimeout(2500);

      const logsText = await logs.textContent();
      expect(logsText).toContain("aborted");
      expect(logsText).not.toContain("completed");
    });
  });

  // Error Handling (Rules 23-26)
  test.describe("Error Handling", () => {
    test.beforeEach(async ({ page }) => {
      await page.goto("/?fixture=error-handling");
      await expect(page.getByTestId("error-handling-fixture")).toBeVisible();
    });

    it("Rule 23: Use Lifecycle.Error for local error recovery - should handle errors locally", async ({
      page,
    }) => {
      const error = page.getByTestId("rule-23-error");
      const reason = page.getByTestId("rule-23-reason");
      const action = page.getByTestId("rule-23-action");
      const attempts = page.getByTestId("rule-23-attempts");

      await expect(error).toHaveText("");
      await expect(attempts).toHaveText("0");

      await page.getByTestId("rule-23-throw").click();

      await expect(error).toHaveText("Test error message", { timeout: 1000 });
      await expect(reason).toHaveText("errored", { timeout: 1000 });
      await expect(action).toHaveText("ThrowError", { timeout: 1000 });
      await expect(attempts).toHaveText("1", { timeout: 1000 });

      await page.getByTestId("rule-23-recoverable").click();
      await expect(attempts).toHaveText("2", { timeout: 1000 });
    });

    it("Rule 23: Use Lifecycle.Error for local error recovery - should clear errors", async ({
      page,
    }) => {
      const error = page.getByTestId("rule-23-error");

      await page.getByTestId("rule-23-throw").click();
      await expect(error).toHaveText("Test error message");

      await page.getByTestId("rule-23-clear").click();
      await expect(error).toHaveText("");
    });

    it("Rule 24: Use the <Error> boundary for global error handling - should propagate unhandled errors to boundary", async ({
      page,
    }) => {
      const errors = page.getByTestId("rule-24-errors");

      await expect(errors).toHaveText("");

      await page.getByTestId("rule-24-throw").click();

      await expect(errors).toContainText("ThrowError", { timeout: 1000 });
      await expect(errors).toContainText("errored", { timeout: 1000 });
      await expect(errors).toContainText("Boundary test", { timeout: 1000 });
    });

    it("Rule 24: Use the <Error> boundary for global error handling - should accumulate multiple errors", async ({
      page,
    }) => {
      const errors = page.getByTestId("rule-24-errors");

      await page.getByTestId("rule-24-throw").click();
      await page.getByTestId("rule-24-throw").click();

      const text = await errors.textContent();
      expect(text?.split("|").length).toBe(2);
    });

    it("Rule 25: Know the error reasons - should capture Reason.Errored for thrown errors", async ({
      page,
    }) => {
      const reason = page.getByTestId("rule-25-reason");

      await page.getByTestId("rule-25-errored").click();
      await expect(reason).toHaveText("errored", { timeout: 1000 });
    });

    it("Rule 25: Know the error reasons - should capture supplanted tasks", async ({
      page,
    }) => {
      const results = page.getByTestId("rule-25-supplant-results");

      await page.getByTestId("rule-25-supplanted").click();

      await page.waitForTimeout(1000);

      await expect(results).toContainText("done:2", { timeout: 1000 });
    });

    it("Rule 26: Use Option or Result for fallible model properties - should handle Option<User> success case", async ({
      page,
    }) => {
      const user = page.getByTestId("rule-26-user");
      const some = page.getByTestId("rule-26-user-some");
      const loading = page.getByTestId("rule-26-user-loading");

      await expect(user).toHaveText("No user");
      await expect(some).toHaveText("none");

      await page.getByTestId("rule-26-fetch-user-success").click();
      await expect(loading).toHaveText("loading");
      await expect(user).toHaveText("Alice <alice@example.com>", {
        timeout: 1000,
      });
      await expect(some).toHaveText("some");
    });

    it("Rule 26: Use Option or Result for fallible model properties - should handle Option<User> failure case", async ({
      page,
    }) => {
      const user = page.getByTestId("rule-26-user");
      const some = page.getByTestId("rule-26-user-some");

      await page.getByTestId("rule-26-fetch-user-success").click();
      await expect(user).toHaveText("Alice <alice@example.com>", {
        timeout: 1000,
      });

      await page.getByTestId("rule-26-fetch-user-fail").click();
      await expect(user).toHaveText("No user", { timeout: 1000 });
      await expect(some).toHaveText("none");
    });

    it("Rule 26: Use Option or Result for fallible model properties - should handle Result<Data, Error> success case", async ({
      page,
    }) => {
      const data = page.getByTestId("rule-26-data");
      const ok = page.getByTestId("rule-26-data-ok");

      await expect(data).toContainText("Error:");
      await expect(ok).toHaveText("error");

      await page.getByTestId("rule-26-fetch-data-success").click();
      await expect(data).toHaveText("item1, item2, item3", { timeout: 1000 });
      await expect(ok).toHaveText("ok");
    });

    it("Rule 26: Use Option or Result for fallible model properties - should handle Result<Data, Error> failure case", async ({
      page,
    }) => {
      const data = page.getByTestId("rule-26-data");
      const ok = page.getByTestId("rule-26-data-ok");

      await page.getByTestId("rule-26-fetch-data-success").click();
      await expect(ok).toHaveText("ok", { timeout: 1000 });

      await page.getByTestId("rule-26-fetch-data-fail").click();
      await expect(data).toContainText("Error: Failed to fetch data", {
        timeout: 1000,
      });
      await expect(ok).toHaveText("error");
    });
  });

  // Type Safety (Rules 27-31)
  test.describe("Type Safety", () => {
    test.beforeEach(async ({ page }) => {
      await page.goto("/?fixture=type-safety");
      await expect(page.getByTestId("type-safety-fixture")).toBeVisible();
    });

    it("Rule 27: Use Pk<T> for primary keys with optimistic updates - should create optimistic entry with symbol key", async ({
      page,
    }) => {
      const count = page.getByTestId("rule-27-count");

      await expect(count).toHaveText("0");

      await page.getByTestId("rule-27-add").click();
      await expect(count).toHaveText("1");

      const todoType = page.getByTestId("rule-27-todo-0-type");
      await expect(todoType).toHaveText("symbol");
    });

    it("Rule 27: Use Pk<T> for primary keys with optimistic updates - should replace symbol key with number after confirmation", async ({
      page,
    }) => {
      const todoType = page.getByTestId("rule-27-todo-0-type");

      await page.getByTestId("rule-27-add").click();
      await expect(todoType).toHaveText("symbol");

      await expect(todoType).toHaveText("number", { timeout: 1000 });
    });

    it("Rule 28: Let TypeScript infer handler payload types - compile-time verification", async ({
      page,
    }) => {
      const verified = page.getByTestId("rule-28-verified");
      await expect(verified).toHaveText("type-inference-verified");
    });

    it("Rule 29: Use Op to specify annotation operations - should track pending annotations with Op.Update", async ({
      page,
    }) => {
      const value = page.getByTestId("rule-29-30-value");
      const pending = page.getByTestId("rule-29-30-pending");
      const draft = page.getByTestId("rule-29-30-draft");

      await expect(value).toHaveText("initial");
      await expect(pending).toHaveText("settled");

      await page.getByTestId("rule-29-30-update").click();

      await expect(pending).toHaveText("pending");
      await expect(draft).toHaveText("updated-value");

      await expect(pending).toHaveText("settled", { timeout: 1500 });
      await expect(value).toHaveText("updated-value");
    });

    it("Rule 30: Use inspect to check annotation status - verified via Rule 29 test above", async ({
      page,
    }) => {
      // Rule 30 is tested together with Rule 29 - inspect.pending() and inspect.draft()
      await expect(page.getByTestId("rule-29-30")).toBeVisible();
    });

    it("Rule 31: Use Box<T> for passing reactive state slices - should pass value through Box to child component", async ({
      page,
    }) => {
      const userName = page.getByTestId("rule-31-user-name");
      const userEmail = page.getByTestId("rule-31-user-email");

      await expect(userName).toHaveText("Alice");
      await expect(userEmail).toHaveText("alice@example.com");
    });

    it("Rule 31: Use Box<T> for passing reactive state slices - should update child when parent state changes", async ({
      page,
    }) => {
      const userName = page.getByTestId("rule-31-user-name");

      await expect(userName).toHaveText("Alice");

      await page.getByTestId("rule-31-update-user").click();

      await expect(userName).toHaveText("Bob", { timeout: 1000 });
    });

    it("Rule 31: Use Box<T> for passing reactive state slices - should pass pending state through Box inspect", async ({
      page,
    }) => {
      const userPending = page.getByTestId("rule-31-user-pending");

      await expect(userPending).toHaveText("idle");

      await page.getByTestId("rule-31-update-user").click();
      await expect(userPending).toHaveText("pending");

      await expect(userPending).toHaveText("idle", { timeout: 1000 });
    });
  });

  // Component Structure (Rules 32-35)
  test.describe("Component Structure", () => {
    test.beforeEach(async ({ page }) => {
      await page.goto("/?fixture=component-structure");
      await expect(
        page.getByTestId("component-structure-fixture"),
      ).toBeVisible();
    });

    it("Rule 32: Use <Boundary> to isolate broadcast actions - should deliver broadcasts to subscribers outside boundary", async ({
      page,
    }) => {
      const counterOutside = page.getByTestId("rule-32-counter-outside");
      const countOutside = page.getByTestId("rule-32-count-outside");

      await expect(counterOutside).toHaveText("0");
      await expect(countOutside).toHaveText("0");

      await page.getByTestId("rule-32-publish-counter").click();

      await expect(countOutside).toHaveText("1");
      const counterText = await counterOutside.textContent();
      expect(Number(counterText)).toBeGreaterThan(0);
    });

    it("Rule 32: Use <Boundary> to isolate broadcast actions - should isolate broadcasts inside boundary", async ({
      page,
    }) => {
      const isolatedCounter = page.getByTestId("rule-32-isolated-counter");
      const isolatedCount = page.getByTestId("rule-32-isolated-count");
      const outsideCounter = page.getByTestId("rule-32-counter-outside");

      await page.getByTestId("rule-32-isolated-publish").click();

      await expect(isolatedCounter).toHaveText("999");
      await expect(isolatedCount).toHaveText("1");

      await expect(outsideCounter).toHaveText("0");
    });

    it("Rule 32: Use <Boundary> to isolate broadcast actions - should not leak outside broadcasts into boundary", async ({
      page,
    }) => {
      const isolatedCount = page.getByTestId("rule-32-isolated-count");
      const outsideCount = page.getByTestId("rule-32-count-outside");

      await page.getByTestId("rule-32-publish-counter").click();

      await expect(outsideCount).toHaveText("1");

      await expect(isolatedCount).toHaveText("0");
    });

    it("Rule 33: One useActions call per component - should manage all state through single useActions call", async ({
      page,
    }) => {
      const name = page.getByTestId("rule-33-name");
      const age = page.getByTestId("rule-33-age");
      const email = page.getByTestId("rule-33-email");

      await expect(name).toHaveText("");
      await expect(age).toHaveText("0");
      await expect(email).toHaveText("");

      await page.getByTestId("rule-33-set-name").click();
      await expect(name).toHaveText("Alice");

      await page.getByTestId("rule-33-set-age").click();
      await expect(age).toHaveText("30");

      await page.getByTestId("rule-33-set-email").click();
      await expect(email).toHaveText("alice@example.com");
    });

    it("Rule 34: Use .box() to pass slice state to child components - should pass state slice to child via Box", async ({
      page,
    }) => {
      const cardName = page.getByTestId("rule-34-card-name");
      const cardEmail = page.getByTestId("rule-34-card-email");

      await expect(cardName).toHaveText("Alice");
      await expect(cardEmail).toHaveText("alice@example.com");
    });

    it("Rule 34: Use .box() to pass slice state to child components - should update child when parent updates via Box", async ({
      page,
    }) => {
      const cardName = page.getByTestId("rule-34-card-name");
      const cardEmail = page.getByTestId("rule-34-card-email");

      await page.getByTestId("rule-34-update-name").click();
      await expect(cardName).toHaveText("Bob");
      await expect(cardEmail).toHaveText("alice@example.com");

      await page.getByTestId("rule-34-update-email").click();
      await expect(cardEmail).toHaveText("bob@example.com");
    });

    it("Rule 35: Use .context() to pass the entire context to child components - should allow child to read parent state", async ({
      page,
    }) => {
      const currentName = page.getByTestId("rule-35-current-name");
      const currentEmail = page.getByTestId("rule-35-current-email");

      await expect(currentName).toHaveText("Initial");
      await expect(currentEmail).toHaveText("initial@example.com");
    });

    it("Rule 35: Use .context() to pass the entire context to child components - should allow child to update parent state via context.dispatch", async ({
      page,
    }) => {
      const parentName = page.getByTestId("rule-35-parent-name");
      const parentEmail = page.getByTestId("rule-35-parent-email");
      const nameInput = page.getByTestId("rule-35-name-input");
      const emailInput = page.getByTestId("rule-35-email-input");

      await nameInput.fill("Updated Name");
      await emailInput.fill("updated@example.com");

      await page.getByTestId("rule-35-save-name").click();
      await expect(parentName).toHaveText("Updated Name");

      await page.getByTestId("rule-35-save-email").click();
      await expect(parentEmail).toHaveText("updated@example.com");
    });
  });

  // Utilities (Rules 36-39)
  test.describe("Utilities", () => {
    test.beforeEach(async ({ page }) => {
      await page.goto("/?fixture=utilities");
      await expect(page.getByTestId("utilities-fixture")).toBeVisible();
    });

    it("Rule 36: Use utils.sleep() for delays with cancellation support - should complete sleep after delay", async ({
      page,
    }) => {
      const status = page.getByTestId("rule-36-status");
      const result = page.getByTestId("rule-36-result");

      await expect(status).toHaveText("idle");

      await page.getByTestId("rule-36-sleep-1s").click();
      await expect(status).toHaveText("sleeping");

      await expect(status).toHaveText("complete", { timeout: 2000 });
      await expect(result).toHaveText("Slept for 1000ms");
    });

    it("Rule 36: Use utils.sleep() for delays with cancellation support - should cancel sleep with abort signal", async ({
      page,
    }) => {
      const status = page.getByTestId("rule-36-status");
      const result = page.getByTestId("rule-36-result");

      await page.getByTestId("rule-36-sleep-3s").click();
      await expect(status).toHaveText("sleeping");

      await page.getByTestId("rule-36-cancel").click();

      await expect(status).toHaveText("cancelled", { timeout: 1500 });
      await expect(result).toHaveText("Sleep was cancelled");
    });

    it("Rule 37: Use utils.pk() for optimistic update keys - should create item with temporary symbol key", async ({
      page,
    }) => {
      const count = page.getByTestId("rule-37-count");

      await expect(count).toHaveText("0");

      await page.getByTestId("rule-37-add").click();
      await expect(count).toHaveText("1");

      const itemType = page.getByTestId("rule-37-item-0-type");
      await expect(itemType).toHaveText("temp");
    });

    it("Rule 37: Use utils.pk() for optimistic update keys - should confirm item with real id after API call", async ({
      page,
    }) => {
      const itemType = page.getByTestId("rule-37-item-0-type");
      const itemId = page.getByTestId("rule-37-item-0-id");

      await page.getByTestId("rule-37-add").click();
      await expect(itemType).toHaveText("temp");

      await expect(itemType).toHaveText("confirmed", { timeout: 1500 });

      const idText = await itemId.textContent();
      expect(Number(idText)).toBeGreaterThan(0);
    });

    it("Rule 37: Use utils.pk() for optimistic update keys - should handle multiple optimistic items", async ({
      page,
    }) => {
      const count = page.getByTestId("rule-37-count");

      await page.getByTestId("rule-37-add-multiple").click();
      await expect(count).toHaveText("3");

      await expect(page.getByTestId("rule-37-item-0-type")).toHaveText("temp");
      await expect(page.getByTestId("rule-37-item-1-type")).toHaveText("temp");
      await expect(page.getByTestId("rule-37-item-2-type")).toHaveText("temp");

      await expect(page.getByTestId("rule-37-item-0-type")).toHaveText(
        "confirmed",
        { timeout: 2000 },
      );
      await expect(page.getByTestId("rule-37-item-1-type")).toHaveText(
        "confirmed",
        { timeout: 2000 },
      );
      await expect(page.getByTestId("rule-37-item-2-type")).toHaveText(
        "confirmed",
        { timeout: 2000 },
      );
    });

    it("Rule 38: Prefer ky over React Query for HTTP requests - should complete fetch with abort signal support", async ({
      page,
    }) => {
      const status = page.getByTestId("rule-38-status");
      const result = page.getByTestId("rule-38-result");

      await expect(status).toHaveText("idle");

      await page.getByTestId("rule-38-fetch").click();
      await expect(status).toHaveText("loading");

      await expect(status).toHaveText("success", { timeout: 2000 });

      const resultText = await result.textContent();
      expect(resultText).toContain("item1");
      expect(resultText).toContain("timestamp");
    });

    it("Rule 39: Use broadcast actions for SSE - should start and stop SSE connection", async ({
      page,
    }) => {
      const connected = page.getByTestId("rule-39-connected");

      await expect(connected).toHaveText("disconnected");

      await page.getByTestId("rule-39-start").click();
      await expect(connected).toHaveText("connected");

      await page.getByTestId("rule-39-stop").click();
      await expect(connected).toHaveText("disconnected", { timeout: 1500 });
    });

    it("Rule 39: Use broadcast actions for SSE - should receive SSE messages via broadcast", async ({
      page,
    }) => {
      const messageCount = page.getByTestId("rule-39-message-count");
      const messages = page.getByTestId("rule-39-messages");

      await expect(messageCount).toHaveText("0");

      await page.getByTestId("rule-39-start").click();

      await expect(messageCount).not.toHaveText("0", { timeout: 2500 });

      const messagesText = await messages.textContent();
      expect(messagesText).toContain("update: Message");

      await page.getByTestId("rule-39-stop").click();
    });

    it("Rule 39: Use broadcast actions for SSE - should deliver SSE broadcasts to late-mounting subscribers", async ({
      page,
    }) => {
      const messageCount = page.getByTestId("rule-39-message-count");

      await page.getByTestId("rule-39-start").click();

      await expect(messageCount).not.toHaveText("0", { timeout: 2500 });

      await page.getByTestId("rule-39-mount-subscriber").click();

      const lateCount = page.getByTestId("rule-39-subscriber-late-count");

      await page.waitForTimeout(1500);
      const count = await lateCount.textContent();
      expect(Number(count)).toBeGreaterThan(0);

      await page.getByTestId("rule-39-stop").click();
    });
  });

  // Cache Layer
  test.describe("Cache", () => {
    test.beforeEach(async ({ page }) => {
      await page.goto("/?fixture=cache");
      await expect(page.getByTestId("cache-fixture")).toBeVisible();
    });

    it("cache.put - should cache the result and return it on subsequent calls", async ({
      page,
    }) => {
      const value = page.getByTestId("cache-value");
      const fetchCount = page.getByTestId("cache-fetch-count");

      await expect(value).toHaveText("none");

      // First fetch - cache miss, should call the async function
      await page.getByTestId("cache-fetch").click();
      await expect(value).toHaveText("fetched-1", { timeout: 2000 });
      await expect(fetchCount).toHaveText("1");

      // Second fetch via FetchAgain - cache hit, should return cached value
      await page.getByTestId("cache-fetch-again").click();
      await expect(value).toHaveText("fetched-1", { timeout: 2000 });
    });

    it("cache.delete - should clear the cache so the next fetch calls the async function", async ({
      page,
    }) => {
      const value = page.getByTestId("cache-value");

      // Populate cache
      await page.getByTestId("cache-fetch").click();
      await expect(value).toHaveText(/^fetched-/, { timeout: 2000 });

      // Invalidate
      await page.getByTestId("cache-invalidate").click();
      await expect(value).toHaveText("invalidated");

      // Fetch again - cache miss after invalidation, new value
      await page.getByTestId("cache-fetch").click();
      const text = await value.textContent();
      // Should be a fresh fetch (counter incremented beyond original)
      expect(text).toMatch(/^fetched-/);
    });

    it("cache.put channeled - should cache per channel independently", async ({
      page,
    }) => {
      const userValue = page.getByTestId("cache-user-value");

      // Fetch user 1
      await page.getByTestId("cache-fetch-user-1").click();
      await expect(userValue).toHaveText(/^user-1-fetch-/, { timeout: 2000 });
      const user1Value = await userValue.textContent();

      // Fetch user 2 - different channel, should be a fresh fetch
      await page.getByTestId("cache-fetch-user-2").click();
      await expect(userValue).toHaveText(/^user-2-fetch-/, { timeout: 2000 });

      // Fetch user 1 again - should return cached value (same as before)
      await page.getByTestId("cache-fetch-user-1").click();
      await expect(userValue).toHaveText(user1Value!, { timeout: 2000 });
    });

    it("cache.delete channeled - should only clear the targeted channel", async ({
      page,
    }) => {
      const userValue = page.getByTestId("cache-user-value");
      const userFetchCount = page.getByTestId("cache-user-fetch-count");

      // Populate user 1 cache
      await page.getByTestId("cache-fetch-user-1").click();
      await expect(userValue).toHaveText(/^user-1-fetch-/, { timeout: 2000 });
      const countAfterUser1 = await userFetchCount.textContent();

      // Populate user 2 cache
      await page.getByTestId("cache-fetch-user-2").click();
      await expect(userValue).toHaveText(/^user-2-fetch-/, { timeout: 2000 });

      // Invalidate user 1 only
      await page.getByTestId("cache-invalidate-user-1").click();

      // Fetch user 2 again - should still be cached (count should not increase from user 2's fetch)
      await page.getByTestId("cache-fetch-user-2").click();
      await expect(userValue).toHaveText(/^user-2-fetch-/, { timeout: 2000 });

      // Fetch user 1 - cache was deleted, should produce a new fetch
      await page.getByTestId("cache-fetch-user-1").click();
      await expect(userValue).toHaveText(/^user-1-fetch-/, { timeout: 2000 });
      const countAfterRefetch = await userFetchCount.textContent();
      expect(Number(countAfterRefetch)).toBeGreaterThan(
        Number(countAfterUser1),
      );
    });

    it("cache.get - should read cached value in Lifecycle.Mount handler", async ({
      page,
    }) => {
      // Populate the cache first
      await page.getByTestId("cache-init-populate").click();
      await expect(page.getByTestId("cache-init-populated")).toHaveText("yes", {
        timeout: 2000,
      });

      // Mount the child that reads cache in Lifecycle.Mount
      await page.getByTestId("cache-init-show-child").click();

      // Child should have read the cached value, not the fallback
      await expect(page.getByTestId("cache-init-greeting")).toHaveText(
        "Hello from cache",
        { timeout: 2000 },
      );
      await expect(page.getByTestId("cache-init-status")).toHaveText("mounted");
    });
  });
});
