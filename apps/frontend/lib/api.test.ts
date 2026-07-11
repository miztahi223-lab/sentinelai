import { describe, it, expect } from "vitest";
import { isPublicAuthRequest } from "./api";

/**
 * Regression test for a real bug: a wrong/reused MFA code was hard-
 * redirecting the whole page to /login instead of showing an inline error,
 * because the global 401 interceptor treated it exactly like an expired
 * session (no refresh token exists yet at that point in the flow, so it
 * fell straight through to the "give up, go to login" branch). Found via
 * live browser testing, not initially covered by any test — this locks the
 * fix in.
 */
describe("isPublicAuthRequest", () => {
  it("treats /auth/login as a public auth request", () => {
    expect(isPublicAuthRequest("/auth/login")).toBe(true);
  });

  it("treats /auth/mfa/verify as a public auth request", () => {
    expect(isPublicAuthRequest("/auth/mfa/verify")).toBe(true);
  });

  it("treats /auth/register as a public auth request", () => {
    expect(isPublicAuthRequest("/auth/register")).toBe(true);
  });

  it("does not treat an authenticated MFA management endpoint as public", () => {
    expect(isPublicAuthRequest("/auth/mfa/enable")).toBe(false);
    expect(isPublicAuthRequest("/auth/mfa/disable")).toBe(false);
    expect(isPublicAuthRequest("/auth/mfa/setup")).toBe(false);
  });

  it("does not treat an unrelated authenticated endpoint as public", () => {
    expect(isPublicAuthRequest("/domains")).toBe(false);
    expect(isPublicAuthRequest("/auth/me")).toBe(false);
  });

  it("handles a missing URL safely", () => {
    expect(isPublicAuthRequest(undefined)).toBe(false);
  });

  it("matches against a full base URL, not just a bare path", () => {
    expect(isPublicAuthRequest("http://localhost:3001/api/auth/mfa/verify")).toBe(
      true,
    );
  });
});
