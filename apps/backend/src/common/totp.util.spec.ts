import {
  generateTotpSecret,
  totpCode,
  verifyTotpCode,
  totpAuthUrl,
} from './totp.util';

describe('totp.util', () => {
  it('generates a real, unique base32 secret each time', () => {
    const a = generateTotpSecret();
    const b = generateTotpSecret();
    expect(a).not.toBe(b);
    expect(a).toMatch(/^[A-Z2-7]+$/);
  });

  it('produces a real, verifiable 6-digit code for a given secret', () => {
    const secret = generateTotpSecret();
    const code = totpCode(secret);
    expect(code).toMatch(/^\d{6}$/);
    expect(verifyTotpCode(secret, code)).toBe(true);
  });

  it('rejects a code generated from a different secret', () => {
    const secretA = generateTotpSecret();
    const secretB = generateTotpSecret();
    const codeForA = totpCode(secretA);
    expect(verifyTotpCode(secretB, codeForA)).toBe(false);
  });

  it('rejects a wrong code', () => {
    const secret = generateTotpSecret();
    const realCode = totpCode(secret);
    const wrongCode = realCode === '000000' ? '111111' : '000000';
    expect(verifyTotpCode(secret, wrongCode)).toBe(false);
  });

  it('tolerates one time-step of clock drift in either direction', () => {
    const secret = generateTotpSecret();
    const now = Date.now() / 1000;
    const oneStepAgo = totpCode(secret, now - 30);
    const oneStepAhead = totpCode(secret, now + 30);
    expect(verifyTotpCode(secret, oneStepAgo)).toBe(true);
    expect(verifyTotpCode(secret, oneStepAhead)).toBe(true);
  });

  it('rejects a code from more than one time-step away', () => {
    const secret = generateTotpSecret();
    const now = Date.now() / 1000;
    const farAway = totpCode(secret, now - 300);
    expect(verifyTotpCode(secret, farAway)).toBe(false);
  });

  it('builds a real otpauth:// URI usable by authenticator apps', () => {
    const secret = generateTotpSecret();
    const url = totpAuthUrl(secret, 'user@example.com', 'SentinelAI');
    expect(url).toMatch(/^otpauth:\/\/totp\//);
    expect(url).toContain(`secret=${secret}`);
    expect(url).toContain('issuer=SentinelAI');
  });
});
