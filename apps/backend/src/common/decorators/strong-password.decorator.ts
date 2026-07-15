import { applyDecorators } from '@nestjs/common';
import { IsStrongPassword, MaxLength } from 'class-validator';

/**
 * The single password-strength policy for every place a user sets or
 * changes their own password (registration, forgot/reset-password,
 * authenticated change-password) — one shared decorator so the rule can
 * never quietly drift between them the way three separate copies of
 * `@MinLength(12)` eventually would (this replaces exactly that: all three
 * DTOs previously duplicated the same length-only check with no complexity
 * requirement). Backed by class-validator's built-in `IsStrongPassword`
 * (battle-tested, not a hand-rolled regex) rather than length alone,
 * matching the same "real security practice, not a checkbox" standard
 * this app's Argon2id hashing already sets — see `password.util.ts`.
 */
export function StrongPassword() {
  return applyDecorators(
    IsStrongPassword(
      {
        minLength: 12,
        minLowercase: 1,
        minUppercase: 1,
        minNumbers: 1,
        minSymbols: 1,
      },
      {
        message:
          'Password must be at least 12 characters and include an uppercase letter, a lowercase letter, a number, and a symbol.',
      },
    ),
    MaxLength(128, { message: 'Password must be no more than 128 characters long' }),
  );
}
