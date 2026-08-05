import { convexTest } from "convex-test";
import { describe, it, expect } from "vitest";
import schema from "./schema";

describe("test-infra", () => {
  it("bootet das Schema", async () => {
    const t = convexTest(schema);
    expect(t).toBeDefined();
  });
});
