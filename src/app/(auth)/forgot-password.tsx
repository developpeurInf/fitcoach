import { Link } from 'expo-router';
import * as Linking from 'expo-linking';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button, Notice, Text, TextField } from '@/components/ui';
import { AuthShell } from '@/features/auth/AuthShell';
import { authErrorMessage } from '@/features/auth/errors';
import { emailSchema } from '@/features/auth/validation';
import { supabase } from '@/lib/supabase';

export default function ForgotPasswordScreen() {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [formError, setFormError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function submit() {
    const parsed = emailSchema.safeParse(email.trim());
    setError(parsed.success ? undefined : t('auth.errors.invalidEmail'));
    if (!parsed.success) return;
    setLoading(true);
    const { error: e } = await supabase.auth.resetPasswordForEmail(parsed.data, {
      redirectTo: Linking.createURL('/'),
    });
    setLoading(false);
    // Same message whether or not the account exists, so emails can't be enumerated.
    if (e && e.code !== 'user_not_found') return setFormError(authErrorMessage(e, t));
    setSent(true);
  }

  return (
    <AuthShell title={t('auth.resetTitle')}>
      <Text variant="caption">{t('auth.resetBody')}</Text>
      {sent ? <Notice>{t('auth.resetSent')}</Notice> : null}
      {formError ? <Notice tone="danger">{formError}</Notice> : null}
      <TextField
        label={t('auth.email')}
        value={email}
        onChangeText={setEmail}
        error={error}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        onSubmitEditing={submit}
      />
      <Button label={t('auth.resetSend')} loading={loading} onPress={submit} disabled={sent} />
      <Link href="/sign-in" replace className="self-center py-2">
        <Text className="font-semibold">{t('auth.back')}</Text>
      </Link>
    </AuthShell>
  );
}
