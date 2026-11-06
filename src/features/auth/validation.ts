import { z } from 'zod';

export const emailSchema = z.email('auth.errors.invalidEmail');
export const passwordSchema = z.string().min(8, 'auth.errors.passwordTooShort');

export const signUpSchema = z
  .object({ email: emailSchema, password: passwordSchema, confirm: z.string() })
  .refine((v) => v.password === v.confirm, {
    path: ['confirm'],
    message: 'auth.errors.passwordMismatch',
  });

/** First error message per field, as i18n keys. */
export function fieldErrors(result: z.ZodSafeParseResult<unknown>): Record<string, string> {
  if (result.success) return {};
  const errors: Record<string, string> = {};
  for (const issue of result.error.issues)
    errors[String(issue.path[0] ?? 'form')] ??= issue.message;
  return errors;
}
