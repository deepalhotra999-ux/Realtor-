import { describe, expect, it } from "vitest";
import { hashPassword, passwordProblems, verifyPassword } from "./password";

describe("password hashing", () => {
  it("round-trips and rejects wrong passwords", async () => {
    const hash = await hashPassword("correct horse battery");
    expect(hash.startsWith("scrypt$")).toBe(true);
    expect(await verifyPassword("correct horse battery", hash)).toBe(true);
    expect(await verifyPassword("wrong", hash)).toBe(false);
  });

  it("salts every hash", async () => {
    expect(await hashPassword("same-password")).not.toBe(await hashPassword("same-password"));
  });

  it("rejects malformed stored hashes", async () => {
    expect(await verifyPassword("x", null)).toBe(false);
    expect(await verifyPassword("x", "bcrypt$abc")).toBe(false);
  });

  it("applies the strength policy", () => {
    expect(passwordProblems("short")).toMatch(/8 characters/);
    expect(passwordProblems("password")).toMatch(/common/);
    expect(passwordProblems("a sensible passphrase")).toBeNull();
  });
});
