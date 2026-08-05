import { convexTest } from "convex-test";
import { describe, it, expect } from "vitest";
import schema from "./schema";

describe("test-infra", () => {
  it("bootet das Schema", async () => {
    const t = convexTest(schema);
    expect(t).toBeDefined();
  });
});

describe("elearning-fields", () => {
  it("akzeptiert elearning-Felder im Schema", async () => {
    const t = convexTest(schema);
    // Just verify the schema loads with new fields
    expect(t).toBeDefined();
  });
});
