import { describe, expect, it } from "vitest";
import * as core from "../src/index.ts";

describe("@curvesel/core", () => {
  it("loads its public API", () => {
    expect(core.packageName).toBe("@curvesel/core");
  });
});
