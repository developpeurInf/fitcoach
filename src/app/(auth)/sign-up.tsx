import { Link } from 'expo-router';
import * as Linking from 'expo-linking';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Button, Notice, Text, TextField } from '@/components/ui';
import { AuthShell } from '@/features/auth/AuthShell';
import { authErrorMessage } from '@/features/auth/errors';
import { GoogleButton } from '@/features/auth/GoogleButton';
import { fieldErrors, signUpSchema } from '@/features/auth/validation';
import { supabase } from '@/lib/supabase';

export default function SignUpScreen() {
  const { t } = useTranslation();
  const [form, setForm] = useState({ email: '', password: '', confirm: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [checkEmail, setCheckEmail] = useState(false);
  const [loading, setLoading] = useState(false);
  const set = (k: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));
  const err = (k: string) => (errors[k] ? t(errors[k] as 'auth.errors.generic') : undefined);

  async function submit() {
    const parsed = signUpSchema.safeParse({ ...form, email: form.email.trim() });
    setErrors(fieldErrors(parsed));
    if (!parsed.success) return;
    setFormError(null);
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: { emailRedirectTo: Linking.createURL('/') },
    });
    setLoading(false);
    if (error) return setFormError(authErrorMessage(error, t));
    // With email confirmation enabled there is no session yet: ask the user to confirm.
    if (!data.session) setCheckEmail(true);
  }

  return (
    <AuthShell title={t('auth.signUpTitle')}>
      {checkEmail ? <Notice>{t('auth.checkEmail')}</Notice> : null}
      {formError ? <Notice tone="danger">{formError}</Notice> : null}
      <TextField
        label={t('auth.email')}
        value={form.email}
        onChangeText={set('email')}
        error={err('email')}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
      />
      <TextField
        label={t('auth.password')}
        value={form.password}
        onChangeText={set('password')}
        error={err('password')}
        secureTextEntry
        autoComplete="new-password"
        textContentType="newPassword"
      />
      <TextField
        label={t('auth.passwordConfirm')}
        value={form.confirm}
        onChangeText={set('confirm')}
        error={err('confirm')}
        secureTextEntry
        autoComplete="new-password"
        onSubmitEditing={submit}
      />
      <Button label={t('auth.signUp')} loading={loading} onPress={submit} />
      <Text variant="caption" className="text-center">
        {t('auth.or')}
      </Text>
      <GoogleButton onError={setFormError} />
      <View className="items-center pt-2">
        <Link href="/sign-in" replace className="py-2">
          <Text className="font-semibold">{t('auth.hasAccount')}</Text>
        </Link>
      </View>
    </AuthShell>
  );
}
