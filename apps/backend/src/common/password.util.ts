import * as argon2 from 'argon2';

/**
 * Shared password hashing/verification — used by both registration
 * (`AuthService`) and the authenticated change-password flow
 * (`UsersController`) so there is exactly one place that decides the
 * hashing algorithm, not two copies that could silently drift apart.
 */
export async function hashPassword(password: string): Promise<string> {
  // argon2id: resistant to both GPU cracking and side-channel attacks, the
  // OWASP-recommended default over bcrypt for new applications.
  return argon2.hash(password, { type: argon2.argon2id });
}

export async function verifyPassword(
  hash: string,
  password: string,
): Promise<boolean> {
  return argon2.verify(hash, password);
}
