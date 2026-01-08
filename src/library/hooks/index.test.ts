import { describe, expect, it } from "@jest/globals";
import { renderHook } from "@testing-library/react";
import { useSnapshot } from "./index.ts";

describe("useSnapshot()", () => {
  it("should return an object with the same properties", () => {
    const props = { name: "Adam", count: 42 };
    const { result } = renderHook(() => useSnapshot(props));

    expect(result.current.name).toBe("Adam");
    expect(result.current.count).toBe(42);
  });

  it("should make properties enumerable", () => {
    const props = { a: 1, b: 2, c: 3 };
    const { result } = renderHook(() => useSnapshot(props));

    expect(Object.keys(result.current)).toEqual(["a", "b", "c"]);
  });

  it("should update when props change on rerender", () => {
    const initialProps = { value: "initial" };
    const { result, rerender } = renderHook(({ props }) => useSnapshot(props), {
      initialProps: { props: initialProps },
    });

    expect(result.current.value).toBe("initial");

    rerender({ props: { value: "updated" } });

    expect(result.current.value).toBe("updated");
  });

  it("should handle nested objects", () => {
    const props = { user: { name: "Adam", age: 30 } };
    const { result } = renderHook(() => useSnapshot(props));

    expect(result.current.user).toEqual({ name: "Adam", age: 30 });
    expect(result.current.user.name).toBe("Adam");
  });

  it("should handle arrays", () => {
    const props = { items: [1, 2, 3] };
    const { result } = renderHook(() => useSnapshot(props));

    expect(result.current.items).toEqual([1, 2, 3]);
  });

  it("should handle null and undefined values", () => {
    const props = { nullable: null, optional: undefined };
    const { result } = renderHook(() => useSnapshot(props));

    expect(result.current.nullable).toBeNull();
    expect(result.current.optional).toBeUndefined();
  });

  it("should maintain reference stability for unchanged props", () => {
    const props = { count: 1 };
    const { result, rerender } = renderHook(() => useSnapshot(props));

    const firstSnapshot = result.current;
    rerender();
    const secondSnapshot = result.current;

    expect(firstSnapshot).toBe(secondSnapshot);
  });

  it("should create new snapshot when props object changes", () => {
    const { result, rerender } = renderHook(({ props }) => useSnapshot(props), {
      initialProps: { props: { count: 1 } },
    });

    const firstSnapshot = result.current;
    rerender({ props: { count: 2 } });
    const secondSnapshot = result.current;

    expect(firstSnapshot).not.toBe(secondSnapshot);
    expect(secondSnapshot.count).toBe(2);
  });
});
