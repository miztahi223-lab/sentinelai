import {
  MfaService,
  MfaAlreadyEnabledError,
  MfaNotSetUpError,
  InvalidMfaCodeError,
} from './mfa.service';
import { totpCode } from '../common/totp.util';
import { hashPassword } from '../common/password.util';

const TEST_KEY = '0'.repeat(63) + '1'; // 64 hex chars = 32 bytes, valid AES-256 key

/**
 * Real unit test over `MfaService` — a minimal in-memory fake stands in for
 * `PrismaService`/`UsersService` (real Postgres integration is covered by
 * `test/mfa.e2e-spec.ts`), but every crypto/TOTP operation here is the real
 * thing: real AES-256-GCM encryption round-trips, real argon2 hashing of
 * backup codes, real TOTP codes computed via the same `totp.util.ts` the
 * service itself uses.
 */
describe('MfaService', () => {
  function makeService(initialUser: {
    id: string;
    passwordHash: string;
    mfaEnabled?: boolean;
    mfaSecret?: string | null;
    mfaBackupCodeHashes?: string[];
  }) {
    const user = {
      email: 'user@example.com',
      mfaEnabled: false,
      mfaSecret: null,
      mfaBackupCodeHashes: [] as string[],
      ...initialUser,
    };
    const configService = {
      get: jest.fn((key: string) =>
        key === 'MFA_ENCRYPTION_KEY' ? TEST_KEY : undefined,
      ),
    };
    const prisma = {
      user: {
        update: jest.fn(({ data }: { data: Partial<typeof user> }) => {
          Object.assign(user, data);
          return Promise.resolve(user);
        }),
      },
    };
    const usersService = {
      findById: jest.fn(() => Promise.resolve({ ...user })),
    };
    const service = new MfaService(
      configService as any,
      prisma as any,
      usersService as any,
    );
    return { service, user };
  }

  it('starts setup with a real secret, not yet enabled', async () => {
    const { service, user } = makeService({
      id: 'u1',
      passwordHash: 'irrelevant',
    });

    const result = await service.beginSetup('u1', 'user@example.com');

    expect(typeof result.secret).toBe('string');
    expect(result.qrCodeDataUrl).toMatch(/^data:image\/png;base64,/);
    expect(user.mfaSecret).not.toBeNull();
    expect(user.mfaEnabled).toBe(false);
  });

  it('refuses to start setup again if MFA is already enabled', async () => {
    const { service } = makeService({
      id: 'u1',
      passwordHash: 'irrelevant',
      mfaEnabled: true,
    });

    await expect(service.beginSetup('u1', 'user@example.com')).rejects.toThrow(
      MfaAlreadyEnabledError,
    );
  });

  it('refuses to enable MFA with a wrong code', async () => {
    const { service } = makeService({ id: 'u1', passwordHash: 'irrelevant' });
    const { secret } = await service.beginSetup('u1', 'user@example.com');
    const wrongCode = totpCode(secret) === '000000' ? '111111' : '000000';

    await expect(service.enable('u1', wrongCode)).rejects.toThrow(
      InvalidMfaCodeError,
    );
  });

  it('refuses to enable MFA if setup was never started', async () => {
    const { service } = makeService({ id: 'u1', passwordHash: 'irrelevant' });
    await expect(service.enable('u1', '123456')).rejects.toThrow(
      MfaNotSetUpError,
    );
  });

  it('enables MFA for real with a correct code, issuing 10 unique backup codes', async () => {
    const { service, user } = makeService({
      id: 'u1',
      passwordHash: 'irrelevant',
    });
    const { secret } = await service.beginSetup('u1', 'user@example.com');
    const code = totpCode(secret);

    const result = await service.enable('u1', code);

    expect(result.backupCodes).toHaveLength(10);
    expect(new Set(result.backupCodes).size).toBe(10);
    expect(user.mfaEnabled).toBe(true);
    expect(user.mfaBackupCodeHashes).toHaveLength(10);
    // The stored values are real argon2 hashes, never the plaintext codes.
    for (const hash of user.mfaBackupCodeHashes) {
      expect(result.backupCodes).not.toContain(hash);
    }
  });

  it('verifyLoginCode accepts a real TOTP code', async () => {
    const { service } = makeService({ id: 'u1', passwordHash: 'irrelevant' });
    const { secret } = await service.beginSetup('u1', 'user@example.com');
    const code = totpCode(secret);
    await service.enable('u1', code);

    await expect(
      service.verifyLoginCode('u1', totpCode(secret)),
    ).resolves.toBeUndefined();
  });

  it('verifyLoginCode consumes a backup code exactly once', async () => {
    const { service, user } = makeService({
      id: 'u1',
      passwordHash: 'irrelevant',
    });
    const { secret } = await service.beginSetup('u1', 'user@example.com');
    const { backupCodes } = await service.enable('u1', totpCode(secret));
    const backupCode = backupCodes[0];

    await expect(
      service.verifyLoginCode('u1', backupCode),
    ).resolves.toBeUndefined();
    expect(user.mfaBackupCodeHashes).toHaveLength(9);

    await expect(service.verifyLoginCode('u1', backupCode)).rejects.toThrow(
      InvalidMfaCodeError,
    );
  });

  it('disable requires the correct password and clears everything', async () => {
    const passwordHash = await hashPassword('CorrectHorse123!');
    const { service, user } = makeService({ id: 'u1', passwordHash });
    const { secret } = await service.beginSetup('u1', 'user@example.com');
    await service.enable('u1', totpCode(secret));

    await expect(service.disable('u1', 'WrongPassword!')).rejects.toThrow(
      'Incorrect password',
    );
    expect(user.mfaEnabled).toBe(true);

    await service.disable('u1', 'CorrectHorse123!');
    expect(user.mfaEnabled).toBe(false);
    expect(user.mfaSecret).toBeNull();
    expect(user.mfaBackupCodeHashes).toHaveLength(0);
  });
});
