import { Task, Tasks } from "./types.ts";
import { describe, expect, it } from "@jest/globals";

describe("Task", () => {
  const actionA = Symbol("ActionA");
  const actionB = Symbol("ActionB");

  it("should create a task with task, action, and payload", () => {
    const controller = new AbortController();
    const payload = { value: 42 };
    const t: Task<{ value: number }> = {
      task: controller,
      action: actionA,
      payload,
    };

    expect(t.task).toBe(controller);
    expect(t.action).toBe(actionA);
    expect(t.payload).toEqual({ value: 42 });
  });

  it("should maintain insertion order in Set (oldest first)", () => {
    const tasks = <Tasks>new Set();

    const task1: Task = {
      task: new AbortController(),
      action: actionA,
      payload: 1,
    };
    const task2: Task = {
      task: new AbortController(),
      action: actionB,
      payload: 2,
    };
    const task3: Task = {
      task: new AbortController(),
      action: actionA,
      payload: 3,
    };

    tasks.add(task1);
    tasks.add(task2);
    tasks.add(task3);

    const tasksArray = [...tasks];
    expect(tasksArray[0]).toBe(task1);
    expect(tasksArray[1]).toBe(task2);
    expect(tasksArray[2]).toBe(task3);
  });

  it("should allow filtering tasks by action", () => {
    const tasks = <Tasks>new Set();

    tasks.add({ task: new AbortController(), action: actionA, payload: 1 });
    tasks.add({ task: new AbortController(), action: actionB, payload: 2 });
    tasks.add({ task: new AbortController(), action: actionA, payload: 3 });

    const actionATasks = [...tasks].filter((t) => t.action === actionA);
    expect(actionATasks).toHaveLength(2);
    expect(actionATasks[0].payload).toBe(1);
    expect(actionATasks[1].payload).toBe(3);
  });

  it("should allow aborting tasks by iterating and filtering", () => {
    const tasks = <Tasks>new Set();

    const task1: Task = {
      task: new AbortController(),
      action: actionA,
      payload: 1,
    };
    const task2: Task = {
      task: new AbortController(),
      action: actionB,
      payload: 2,
    };

    tasks.add(task1);
    tasks.add(task2);

    // Abort all tasks for actionA
    for (const t of tasks) {
      if (t.action === actionA) {
        t.task.abort();
      }
    }

    expect(task1.task.signal.aborted).toBe(true);
    expect(task2.task.signal.aborted).toBe(false);
  });

  it("should allow removing tasks from Set", () => {
    const tasks = <Tasks>new Set();

    const task1: Task = {
      task: new AbortController(),
      action: actionA,
      payload: 1,
    };
    const task2: Task = {
      task: new AbortController(),
      action: actionB,
      payload: 2,
    };

    tasks.add(task1);
    tasks.add(task2);
    expect(tasks.size).toBe(2);

    tasks.delete(task1);
    expect(tasks.size).toBe(1);
    expect(tasks.has(task1)).toBe(false);
    expect(tasks.has(task2)).toBe(true);
  });

  it("should allow aborting oldest task first", () => {
    const tasks = <Tasks>new Set();

    const task1: Task = {
      task: new AbortController(),
      action: actionA,
      payload: 1,
    };
    const task2: Task = {
      task: new AbortController(),
      action: actionA,
      payload: 2,
    };

    tasks.add(task1);
    tasks.add(task2);

    // Get oldest task (first in iteration order)
    const oldest = tasks.values().next().value;
    oldest?.task.abort();

    expect(task1.task.signal.aborted).toBe(true);
    expect(task2.task.signal.aborted).toBe(false);
  });

  it("should support abort with reason", () => {
    const t: Task = {
      task: new AbortController(),
      action: actionA,
      payload: null,
    };

    const reason = "Unmounted";
    t.task.abort(reason);

    expect(t.task.signal.aborted).toBe(true);
    expect(t.task.signal.reason).toBe(reason);
  });
});
