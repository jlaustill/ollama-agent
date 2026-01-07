import { describe, it, expect } from "vitest";
import add from "./add";

describe("add", () => {
  it("should add two positive numbers", () => {
    expect(add(2, 3)).toBe(5);
  });

  it("should add negative numbers", () => {
    expect(add(-2, -3)).toBe(-5);
  });

  it("should add mixed sign numbers", () => {
    expect(add(5, -3)).toBe(2);
  });

  it("should handle zero", () => {
    expect(add(0, 5)).toBe(5);
    expect(add(5, 0)).toBe(5);
  });
});
