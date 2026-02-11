/**
 * E2E Test Fixtures App
 *
 * This app serves as the entry point for all Playwright e2e tests.
 * Each fixture demonstrates specific rules from RULEBOOK.md.
 *
 * Usage: Navigate to /?fixture=<fixture-name> to render a specific fixture.
 */
import * as React from "react";
import { createRoot } from "react-dom/client";
import { Boundary, Error, Reason } from "../../src/library/index.ts";

// Fixture imports - Rules 1-4: Actions
import { ActionsFixture } from "./rules/actions.tsx";

// Fixture imports - Rules 5-7: State Updates
import { StateUpdatesFixture } from "./rules/state-updates.tsx";

// Fixture imports - Rules 8-12: Handlers
import { HandlersFixture } from "./rules/handlers.tsx";

// Fixture imports - Rules 13-15: Lifecycles
import { LifecyclesFixture } from "./rules/lifecycles.tsx";

// Fixture imports - Rules 16-19: Broadcast Actions
import { BroadcastActionsFixture } from "./rules/broadcast-actions.tsx";

// Fixture imports - Rules 20-22: Task Management
import { TaskManagementFixture } from "./rules/task-management.tsx";

// Fixture imports - Rules 23-26: Error Handling
import { ErrorHandlingFixture } from "./rules/error-handling.tsx";

// Fixture imports - Rules 27-31: Type Safety
import { TypeSafetyFixture } from "./rules/type-safety.tsx";

// Fixture imports - Rules 32-35: Component Structure
import { ComponentStructureFixture } from "./rules/component-structure.tsx";

// Fixture imports - Rules 36-39: Utilities
import { UtilitiesFixture } from "./rules/utilities.tsx";

const fixtures: Record<string, React.ComponentType> = {
  actions: ActionsFixture,
  "state-updates": StateUpdatesFixture,
  handlers: HandlersFixture,
  lifecycles: LifecyclesFixture,
  "broadcast-actions": BroadcastActionsFixture,
  "task-management": TaskManagementFixture,
  "error-handling": ErrorHandlingFixture,
  "type-safety": TypeSafetyFixture,
  "component-structure": ComponentStructureFixture,
  utilities: UtilitiesFixture,
};

function App() {
  const params = new URLSearchParams(window.location.search);
  const fixtureName = params.get("fixture") ?? "index";

  const [errors, setErrors] = React.useState<string[]>([]);

  if (fixtureName === "index") {
    return (
      <div data-testid="fixture-index">
        <h1>Chizu E2E Test Fixtures</h1>
        <ul>
          {Object.keys(fixtures).map((name) => (
            <li key={name}>
              <a href={`?fixture=${name}`}>{name}</a>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  const Fixture = fixtures[fixtureName];
  if (!Fixture) {
    return (
      <div data-testid="fixture-not-found">
        <h1>Fixture not found: {fixtureName}</h1>
        <a href="/">Back to index</a>
      </div>
    );
  }

  return (
    <Boundary>
      <Error
        handler={({ reason, error, action }) => {
          setErrors((prev) => [
            ...prev,
            JSON.stringify({ reason, message: error.message, action }),
          ]);
        }}
      >
        <div data-testid={`fixture-${fixtureName}`}>
          <Fixture />
        </div>
        {errors.length > 0 && (
          <div data-testid="error-log">
            {errors.map((err, i) => (
              <div key={i} data-testid={`error-${i}`}>
                {err}
              </div>
            ))}
          </div>
        )}
      </Error>
    </Boundary>
  );
}

const container = document.getElementById("root");
if (container) {
  const root = createRoot(container);
  root.render(<App />);
}
