import { validateEnv } from "./env.validation";

const REAL_SECRET_A = "3f9a1c2e5b7d8f0a1c3e5b7d9f1a3c5e7b9d1f3a5c7e9b1d3f5a7c9e1b3d5f7a";
const REAL_SECRET_B = "9d1f3a5c7e9b1d3f5a7c9e1b3d5f7a3f9a1c2e5b7d8f0a1c3e5b7d9f1a3c5e7b";

function baseConfig(overrides: Record<string, unknown> = {}) {
  return {
    DATABASE_URL: "postgresql://user:pass@localhost:5432/db",
    CORS_ORIGIN: "http://localhost:5173",
    JWT_ACCESS_SECRET: REAL_SECRET_A,
    JWT_REFRESH_SECRET: REAL_SECRET_B,
    ...overrides,
  };
}

describe("validateEnv — JWT secret hardening (P0-E1-F2-T4)", () => {
  it("accepts a real, randomly-generated hex secret", () => {
    expect(() => validateEnv(baseConfig())).not.toThrow();
  });

  it("rejects the actual placeholder shipped in apps/api/.env.example", () => {
    expect(() =>
      validateEnv(baseConfig({ JWT_ACCESS_SECRET: "change-me-access-secret" })),
    ).toThrow();
  });

  it("rejects a secret shorter than 32 characters even if not an obvious placeholder", () => {
    expect(() =>
      validateEnv(baseConfig({ JWT_ACCESS_SECRET: "a1b2c3d4e5f6a1b2c3d4e5f6" })), // 24 chars
    ).toThrow();
  });

  it.each([
    "changeme-access-secret-changeme-access-secret",
    "my-super-secret-value-my-super-secret-value",
    "password-password-password-password-password",
    "placeholder-placeholder-placeholder-placeholder",
    "TODO-fill-this-in-TODO-fill-this-in-TODO",
    "example-value-example-value-example-value",
    "your-secret-goes-here-your-secret-goes-here",
  ])("rejects a long-enough-but-still-a-placeholder value: %s", (value) => {
    expect(() => validateEnv(baseConfig({ JWT_ACCESS_SECRET: value }))).toThrow();
  });

  it("never false-positives on a real hex secret (hex cannot contain any denylisted word)", () => {
    // 64 hex chars, the exact shape `openssl rand -hex 32` produces.
    const hex = "0123456789abcdef".repeat(4);
    expect(() => validateEnv(baseConfig({ JWT_ACCESS_SECRET: hex, JWT_REFRESH_SECRET: hex }))).not.toThrow();
  });

  it("still enforces the other required fields unrelated to this change", () => {
    expect(() => validateEnv(baseConfig({ DATABASE_URL: "" }))).toThrow();
    expect(() => validateEnv(baseConfig({ CORS_ORIGIN: "" }))).toThrow();
  });
});
