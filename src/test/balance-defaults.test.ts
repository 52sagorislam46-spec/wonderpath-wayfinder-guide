import { describe, expect, it } from "vitest";
import { STARTER_STARS } from "../components/fly/balance-defaults";

describe("No demo credit", () => {
  it("starts unfunded accounts with exactly zero stars", () => {
    expect(STARTER_STARS).toBe(0);
  });
});