import { validate } from 'class-validator';
import { StrongPassword } from './strong-password.decorator';

class Subject {
  @StrongPassword()
  password!: string;
}

async function errorsFor(password: string) {
  const subject = new Subject();
  subject.password = password;
  return validate(subject);
}

describe('StrongPassword', () => {
  it('accepts a password with length + all four character classes', async () => {
    expect(await errorsFor('Correct-Horse9')).toHaveLength(0);
  });

  it('rejects a password that is long but missing a character class', async () => {
    // 14 lowercase letters — long enough, but no uppercase/number/symbol.
    expect(await errorsFor('alllowercaseletters')).not.toHaveLength(0);
  });

  it('rejects a password shorter than 12 characters even with every character class', async () => {
    expect(await errorsFor('Ab1!')).not.toHaveLength(0);
  });

  it('rejects a password over 128 characters', async () => {
    expect(await errorsFor(`Aa1!${'x'.repeat(126)}`)).not.toHaveLength(0);
  });

  it('rejects a non-string value', async () => {
    const subject = new Subject();
    (subject as unknown as { password: number }).password = 12345678901234;
    expect(await validate(subject)).not.toHaveLength(0);
  });
});
