import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { createHmac } from 'crypto';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';

/**
 * A standalone RFC 6238 TOTP implementation, deliberately independent of
 * the server's own `otplib` — this test needs to *independently* prove the
 * server verifies real codes correctly, which a shared implementation
 * couldn't do (a bug present in both would cancel out and the test would
 * still pass). Also sidesteps a real Jest/ts-jest issue: `otplib` v13's
 * dependency chain pulls in an ESM-only package (`@scure/base`) that Jest's
 * default CJS module resolution can't parse, unrelated to whether the
 * library itself works (it does — verified manually via plain `node -e`
 * against the real server).
 */
function base32Decode(base32: string): Buffer {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = '';
  for (const char of base32.toUpperCase().replace(/=+$/, '')) {
    const idx = alphabet.indexOf(char);
    if (idx === -1) continue;
    bits += idx.toString(2).padStart(5, '0');
  }
  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.slice(i, i + 8), 2));
  }
  return Buffer.from(bytes);
}

function totp(
  base32Secret: string,
  forEpochSeconds = Date.now() / 1000,
): string {
  const key = base32Decode(base32Secret);
  const counter = Math.floor(forEpochSeconds / 30);
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeBigUInt64BE(BigInt(counter));

  const hmac = createHmac('sha1', key).update(counterBuffer).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binary =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  return (binary % 1_000_000).toString().padStart(6, '0');
}

/**
 * A genuine end-to-end test against the real local Postgres stack —
 * registers a real user, walks through the full real TOTP setup/enable
 * flow (computing real 6-digit codes from the real secret the server
 * returns, verified independently as described above), confirms login
 * actually requires the second factor once enabled, and confirms backup
 * codes are genuinely single-use.
 */
describe('MFA (e2e)', () => {
  let app: INestApplication<App>;

  const email = `e2e-mfa-${Date.now()}@sentinelai.dev`;
  const password = 'SuperSecret123!';
  let accessToken: string;
  let secret: string;
  let backupCodes: string[];

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.setGlobalPrefix('api');
    await app.init();

    const registerRes = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        email,
        password,
        name: 'MFA Test User',
        organizationName: `E2E MFA Org ${Date.now()}`,
      });
    accessToken = registerRes.body.accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  it('reports MFA as disabled by default', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    expect(res.body.mfaEnabled).toBe(false);
  });

  it('starts real MFA setup and returns a usable secret + QR code', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/mfa/setup')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(typeof res.body.secret).toBe('string');
    expect(res.body.qrCodeDataUrl).toMatch(/^data:image\/png;base64,/);
    secret = res.body.secret;
  });

  it('rejects enabling MFA with a wrong code', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/mfa/enable')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ code: '000000' })
      .expect(400);
  });

  it('enables MFA for real with a genuine TOTP code, returning 10 real backup codes', async () => {
    const code = totp(secret);
    const res = await request(app.getHttpServer())
      .post('/api/auth/mfa/enable')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ code })
      .expect(200);

    expect(res.body.backupCodes).toHaveLength(10);
    backupCodes = res.body.backupCodes;

    const meRes = await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    expect(meRes.body.mfaEnabled).toBe(true);
  });

  it('login now returns a challenge instead of real tokens', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email, password })
      .expect(200);

    expect(res.body.mfaRequired).toBe(true);
    expect(typeof res.body.challengeToken).toBe('string');
    expect(res.body.accessToken).toBeUndefined();
  });

  it('rejects a wrong TOTP code at the verify step', async () => {
    const loginRes = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email, password })
      .expect(200);

    await request(app.getHttpServer())
      .post('/api/auth/mfa/verify')
      .send({ challengeToken: loginRes.body.challengeToken, code: '000000' })
      .expect(401);
  });

  it('completes login for real with a genuine TOTP code', async () => {
    const loginRes = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email, password })
      .expect(200);

    const code = totp(secret);
    const verifyRes = await request(app.getHttpServer())
      .post('/api/auth/mfa/verify')
      .send({ challengeToken: loginRes.body.challengeToken, code })
      .expect(200);

    expect(typeof verifyRes.body.accessToken).toBe('string');
    expect(typeof verifyRes.body.refreshToken).toBe('string');
  });

  it('accepts a real backup code exactly once, then rejects it on reuse', async () => {
    const loginRes = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email, password })
      .expect(200);

    const backupCode = backupCodes[0];

    await request(app.getHttpServer())
      .post('/api/auth/mfa/verify')
      .send({ challengeToken: loginRes.body.challengeToken, code: backupCode })
      .expect(200);

    // Same backup code, a fresh challenge — must fail: already consumed.
    const secondLoginRes = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email, password })
      .expect(200);

    await request(app.getHttpServer())
      .post('/api/auth/mfa/verify')
      .send({
        challengeToken: secondLoginRes.body.challengeToken,
        code: backupCode,
      })
      .expect(401);
  });

  it('disables MFA for real when the correct password is presented', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/mfa/disable')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ password: 'TotallyWrongPassword!' })
      .expect(401);

    await request(app.getHttpServer())
      .post('/api/auth/mfa/disable')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ password })
      .expect(200);

    const meRes = await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    expect(meRes.body.mfaEnabled).toBe(false);

    // Login goes back to issuing real tokens directly, no challenge step.
    const loginRes = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email, password })
      .expect(200);
    expect(loginRes.body.mfaRequired).toBe(false);
    expect(typeof loginRes.body.accessToken).toBe('string');
  });
});
