import { describe, expect, it } from "vitest";
import * as core from "../src/index.ts";

describe("@curvesel/core", () => {
  it("exports the package name when imported", () => {
    expect(core.packageName).toBe("@curvesel/core");
  });
});
