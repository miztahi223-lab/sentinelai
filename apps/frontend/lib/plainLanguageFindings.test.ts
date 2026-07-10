import { describe, expect, it } from "vitest";
import { toPlainLanguage } from "./plainLanguageFindings";

describe("toPlainLanguage", () => {
  it("translates a missing TLS certificate without using the word TLS", () => {
    const result = toPlainLanguage(
      "No valid TLS certificate observed",
      "No TLS certificate could be retrieved on port 443 — the site may be HTTP-only or unreachable over HTTPS.",
    );
    expect(result.headline.toLowerCase()).not.toContain("tls");
    expect(result.explanation.toLowerCase()).not.toContain("tls");
    expect(result.headline).toBe("Your website is not secure");
  });

  it("translates an invalid certificate", () => {
    const result = toPlainLanguage("Invalid TLS certificate", "x");
    expect(result.headline).toBe("Your website's security is broken");
  });

  it("translates a self-signed certificate", () => {
    const result = toPlainLanguage("Self-signed TLS certificate", "x");
    expect(result.headline).toBe("Your website's security isn't trusted");
  });

  it("translates an expired certificate", () => {
    const result = toPlainLanguage("TLS certificate has expired", "x");
    expect(result.headline).toBe("Your website's security has expired");
  });

  it("translates a certificate expiring within 7 days", () => {
    const result = toPlainLanguage("TLS certificate expires within 7 days", "x");
    expect(result.headline).toContain("expires this week");
  });

  it("translates a certificate expiring within 30 days", () => {
    const result = toPlainLanguage("TLS certificate expires within 30 days", "x");
    expect(result.headline).toBe("Your website's security needs renewing soon");
  });

  it("translates missing security headers and carries the real count through", () => {
    const result = toPlainLanguage("3 recommended security header(s) missing", "x");
    expect(result.headline).toContain("3 basic protection(s)");
  });

  it("translates a disclosed server technology version", () => {
    const result = toPlainLanguage(
      "Server technology version disclosed in response headers",
      "x",
    );
    expect(result.headline).toBe("Your website is revealing what software it runs");
  });

  it("translates a large exposed IP footprint and carries the real count through", () => {
    const result = toPlainLanguage("Large number of exposed IP addresses (47)", "x");
    expect(result.headline).toContain("47 addresses");
  });

  it("translates recent asset changes and carries the real count through", () => {
    const result = toPlainLanguage("12 asset change(s) in the last 7 days", "x");
    expect(result.headline).toContain("12 change(s)");
  });

  it("falls back to the original text for an unrecognized finding type", () => {
    const result = toPlainLanguage("Some future finding type", "Its real description.");
    expect(result.headline).toBe("Some future finding type");
    expect(result.explanation).toBe("Its real description.");
  });

  it("translates into Hebrew when the reader's UI locale is Hebrew, without using the word TLS", () => {
    const result = toPlainLanguage(
      "No valid TLS certificate observed",
      "No TLS certificate could be retrieved on port 443 — the site may be HTTP-only or unreachable over HTTPS.",
      "he",
    );
    expect(result.headline).toBe("האתר שלכם לא מאובטח");
    expect(result.headline).not.toContain("TLS");
    expect(result.explanation).not.toContain("TLS");
  });

  it("carries a real dynamic count through into the Hebrew translation too", () => {
    const result = toPlainLanguage(
      "3 recommended security header(s) missing",
      "x",
      "he",
    );
    expect(result.headline).toContain("3");
  });

  it("falls back to the original (English) text for an unrecognized finding type even under a Hebrew locale", () => {
    const result = toPlainLanguage(
      "Some future finding type",
      "Its real description.",
      "he",
    );
    expect(result.headline).toBe("Some future finding type");
    expect(result.explanation).toBe("Its real description.");
  });
});
