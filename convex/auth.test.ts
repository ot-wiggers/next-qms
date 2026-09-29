import { describe, it, expect } from "vitest";
import { assertSignupAllowed } from "./auth";

describe("Registrierungssperre", () => {
  it("lässt nur Firmen-Adressen zu", () => {
    expect(() => assertSignupAllowed("Max.Muster@OT-Wiggers.de ")).not.toThrow();
    expect(() => assertSignupAllowed("probe@example.com")).toThrow(/ot-wiggers\.de/);
    expect(() => assertSignupAllowed("x@ot-wiggers.de.evil.com")).toThrow();
    expect(() => assertSignupAllowed("")).toThrow();
  });
});
