import type { TFunction } from 'i18next';

/** Maps Supabase Auth error codes to a clear, translated message. */
export function authErrorMessage(error: unknown, t: TFunction): string {
  const code = (error as { code?: string } | null)?.code;
  switch (code) {
    case 'invalid_credentials':
      return t('auth.errors.invalidCredentials');
    case 'email_not_confirmed':
      return t('auth.errors.emailNotConfirmed');
    case 'user_already_exists':
    case 'email_exists':
      return t('auth.errors.userExists');
    case 'weak_password':
      return t('auth.errors.weakPassword');
    case 'over_email_send_rate_limit':
    case 'over_request_rate_limit':
      return t('auth.errors.rateLimited');
    default:
      return t('auth.errors.generic');
  }
}
