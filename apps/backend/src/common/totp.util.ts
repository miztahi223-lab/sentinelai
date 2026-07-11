import { createHmac, randomBytes } from 'crypto';

/**
 * A small, self-contained RFC 6238 (TOTP) / RFC 4226 (HOTP) implementation
 * using only Node's built-in `crypto` — deliberately not the `otplib`
 * package: its v13 plugin architecture pulls in `@scure/base`, a pure-ESM
 * dependency with no CommonJS build at all, which broke `ts-jest`'s module
 * resolution for every e2e test the moment `MfaService` was imported (the
 * real running app, built via `nest build`/`nest start --watch`, handled it
 * fine — this was purely a test-tooling incompatibility, but a real,
 * global one). TOTP itself is a small, precisely-specified algorithm built
 * entirely on an audited primitive (`crypto.createHmac`), not "rolling your
 * own crypto" in the risky sense — this is the same trade-off already made
 * throughout this codebase (e.g. rolling refresh-token rotation on top of
 * `crypto.randomBytes`/`createHash` rather than pulling in a session
 * library).
 */

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const STEP_SECONDS = 30;
const CODE_DIGITS = 6;

function base32Encode(buffer: Buffer): string {
  let bits = '';
  for (const byte of buffer) bits += byte.toString(2).padStart(8, '0');
  let output = '';
  for (let i = 0; i + 5 <= bits.length; i += 5) {
    output += BASE32_ALPHABET[parseInt(bits.slice(i, i + 5), 2)];
  }
  const remainder = bits.length % 5;
  if (remainder > 0) {
    const lastChunk = bits.slice(bits.length - remainder).padEnd(5, '0');
    output += BASE32_ALPHABET[parseInt(lastChunk, 2)];
  }
  return output;
}

function base32Decode(base32: string): Buffer {
  let bits = '';
  for (const char of base32.toUpperCase().replace(/=+$/, '')) {
    const idx = BASE32_ALPHABET.indexOf(char);
    if (idx === -1) continue; // ignore whitespace/invalid characters defensively
    bits += idx.toString(2).padStart(5, '0');
  }
  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.slice(i, i + 8), 2));
  }
  return Buffer.from(bytes);
}

/** A fresh, random 160-bit (20-byte) shared secret, base32-encoded for QR/manual entry — the standard TOTP secret size (matches Google Authenticator, Authy, 1Password, etc.). */
export function generateTotpSecret(): string {
  return base32Encode(randomBytes(20));
}

function hotp(key: Buffer, counter: number): string {
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeBigUInt64BE(BigInt(counter));
  const hmac = createHmac('sha1', key).update(counterBuffer).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binary =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  const modulus = 10 ** CODE_DIGITS;
  return (binary % modulus).toString().padStart(CODE_DIGITS, '0');
}

/** The current 6-digit TOTP code for `base32Secret`, for a given moment (defaults to now). */
export function totpCode(
  base32Secret: string,
  epochSeconds: number = Date.now() / 1000,
): string {
  const counter = Math.floor(epochSeconds / STEP_SECONDS);
  return hotp(base32Decode(base32Secret), counter);
}

/**
 * Checks `code` against the current time step and one step on either side
 * (±30s) — the standard tolerance for clock drift between server and
 * authenticator app, same window `otplib`/Google Authenticator itself
 * allows by default.
 */
export function verifyTotpCode(base32Secret: string, code: string): boolean {
  const now = Date.now() / 1000;
  for (const drift of [0, -1, 1]) {
    if (totpCode(base32Secret, now + drift * STEP_SECONDS) === code) {
      return true;
    }
  }
  return false;
}

/** The `otpauth://` URI authenticator apps scan via QR code to add an account. */
export function totpAuthUrl(
  base32Secret: string,
  accountLabel: string,
  issuer: string,
): string {
  const label = encodeURIComponent(`${issuer}:${accountLabel}`);
  const params = new URLSearchParams({ secret: base32Secret, issuer });
  return `otpauth://totp/${label}?${params.toString()}`;
}
