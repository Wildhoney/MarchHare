import { describe, expect, it } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { annotate } from "./index.ts";
import { useActions } from "../hooks/index.ts";
import { Action } from "../action/index.ts";
import { Operation } from "immertation";

type Model = { name: string | null };

const _Actions = <const>{ SetName: Action<string>("SetName") };

describe("annotate()", () => {
  it("should mark an initial model field as pending with Op.Update", () => {
    const model: Model = {
      name: annotate(Operation.Update, null),
    };

    const { result } = renderHook(() => {
      const actions = useActions<Model, typeof _Actions>(model);
      return actions;
    });

    const [currentModel, actions] = result.current;
    expect(currentModel.name).toBeNull();
    expect(actions.inspect.name.pending()).toBe(true);
    expect(actions.inspect.name.is(Operation.Update)).toBe(true);
  });

  it("should mark an initial model field as pending with Op.Add", () => {
    const model: Model = {
      name: annotate(Operation.Add, null),
    };

    const { result } = renderHook(() => {
      const actions = useActions<Model, typeof _Actions>(model);
      return actions;
    });

    const [, actions] = result.current;
    expect(actions.inspect.name.pending()).toBe(true);
    expect(actions.inspect.name.is(Operation.Add)).toBe(true);
    expect(actions.inspect.name.is(Operation.Update)).toBe(false);
  });

  it("should mark an initial model field as pending with Op.Remove", () => {
    const model: Model = {
      name: annotate(Operation.Remove, "about-to-go"),
    };

    const { result } = renderHook(() => {
      const actions = useActions<Model, typeof _Actions>(model);
      return actions;
    });

    const [currentModel, actions] = result.current;
    expect(currentModel.name).toBe("about-to-go");
    expect(actions.inspect.name.pending()).toBe(true);
    expect(actions.inspect.name.is(Operation.Remove)).toBe(true);
  });

  it("should preserve the annotated value as the model value", () => {
    const model: Model = {
      name: annotate(Operation.Update, "initial"),
    };

    const { result } = renderHook(() => {
      const actions = useActions<Model, typeof _Actions>(model);
      return actions;
    });

    expect(result.current[0].name).toBe("initial");
  });

  it("should report remaining count of 1 for a single annotation", () => {
    const model: Model = {
      name: annotate(Operation.Update, null),
    };

    const { result } = renderHook(() => {
      const actions = useActions<Model, typeof _Actions>(model);
      return actions;
    });

    expect(result.current[1].inspect.name.remaining()).toBe(1);
  });

  it("should annotate multiple fields independently", () => {
    type MultiModel = { name: string | null; age: number };

    const model: MultiModel = {
      name: annotate(Operation.Update, null),
      age: annotate(Operation.Add, 0),
    };

    const { result } = renderHook(() => {
      const actions = useActions<MultiModel, typeof _Actions>(model);
      return actions;
    });

    const [currentModel, actions] = result.current;
    expect(currentModel.name).toBeNull();
    expect(currentModel.age).toBe(0);
    expect(actions.inspect.name.pending()).toBe(true);
    expect(actions.inspect.name.is(Operation.Update)).toBe(true);
    expect(actions.inspect.age.pending()).toBe(true);
    expect(actions.inspect.age.is(Operation.Add)).toBe(true);
  });

  it("should clear annotations after produce prunes the hydration process", async () => {
    const model: Model = {
      name: annotate(Operation.Update, null),
    };

    const { result } = renderHook(() => {
      const actions = useActions<Model, typeof _Actions>(model);

      actions.useAction(_Actions.SetName, (context, name) => {
        context.actions.produce(({ model }) => {
          model.name = name;
        });
      });

      return actions;
    });

    expect(result.current[1].inspect.name.pending()).toBe(true);

    await act(async () => {
      result.current[1].dispatch(_Actions.SetName, "Adam");
    });

    expect(result.current[0].name).toBe("Adam");
    expect(result.current[1].inspect.name.pending()).toBe(false);
  });

  it("should leave unannotated fields as not pending", () => {
    type MixedModel = { name: string | null; count: number };

    const model: MixedModel = {
      name: annotate(Operation.Update, null),
      count: 42,
    };

    const { result } = renderHook(() => {
      const actions = useActions<MixedModel, typeof _Actions>(model);
      return actions;
    });

    const [currentModel, actions] = result.current;
    expect(currentModel.count).toBe(42);
    expect(actions.inspect.count.pending()).toBe(false);
    expect(actions.inspect.name.pending()).toBe(true);
  });

  it("should expose the draft value via inspect.draft()", () => {
    const model: Model = {
      name: annotate(Operation.Update, "loading"),
    };

    const { result } = renderHook(() => {
      const actions = useActions<Model, typeof _Actions>(model);
      return actions;
    });

    expect(result.current[1].inspect.name.draft()).toBe("loading");
  });
});
