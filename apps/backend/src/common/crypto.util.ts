import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

export class InvalidEncryptionKeyError extends Error {
  constructor() {
    super(
      'MFA_ENCRYPTION_KEY must be a 32-byte key, hex-encoded (64 hex characters).',
    );
    this.name = 'InvalidEncryptionKeyError';
  }
}

function parseKey(hexKey: string): Buffer {
  const key = Buffer.from(hexKey, 'hex');
  if (key.length !== 32) throw new InvalidEncryptionKeyError();
  return key;
}

/**
 * AES-256-GCM encryption for data that (unlike a password) must be
 * decryptable later — right now, only the MFA TOTP shared secret. Output is
 * `base64(iv || authTag || ciphertext)`, self-contained so no separate
 * column is needed for the IV.
 */
export function encryptSecret(plaintext: string, hexKey: string): string {
  const key = parseKey(hexKey);
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, ciphertext]).toString('base64');
}

export function decryptSecret(encoded: string, hexKey: string): string {
  const key = parseKey(hexKey);
  const raw = Buffer.from(encoded, 'base64');
  const iv = raw.subarray(0, IV_LENGTH);
  const authTag = raw.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const ciphertext = raw.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]).toString('utf8');
}
