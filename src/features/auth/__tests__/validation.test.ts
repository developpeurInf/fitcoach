import { fieldErrors, signUpSchema } from '../validation';

describe('sign-up validation', () => {
  it('accepts matching passwords', () => {
    expect(
      signUpSchema.safeParse({ email: 'a@b.fr', password: 'motdepasse', confirm: 'motdepasse' })
        .success,
    ).toBe(true);
  });

  it('reports each invalid field once', () => {
    const r = signUpSchema.safeParse({ email: 'nope', password: 'short', confirm: 'other' });
    expect(fieldErrors(r)).toEqual({
      email: 'auth.errors.invalidEmail',
      password: 'auth.errors.passwordTooShort',
      confirm: 'auth.errors.passwordMismatch',
    });
  });

  it('reports mismatched passwords', () => {
    const r = signUpSchema.safeParse({
      email: 'a@b.fr',
      password: 'motdepasse',
      confirm: 'autrechose',
    });
    expect(fieldErrors(r)).toEqual({ confirm: 'auth.errors.passwordMismatch' });
  });
});
