import { Link } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Button, Notice, Text, TextField } from '@/components/ui';
import { AuthShell } from '@/features/auth/AuthShell';
import { authErrorMessage } from '@/features/auth/errors';
import { GoogleButton } from '@/features/auth/GoogleButton';
import { emailSchema, passwordSchema } from '@/features/auth/validation';
import { supabase } from '@/lib/supabase';

export default function SignInScreen() {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit() {
    const e = emailSchema.safeParse(email.trim());
    const p = passwordSchema.safeParse(password);
    setErrors({
      email: e.success ? undefined : t(e.error.issues[0]!.message as 'auth.errors.invalidEmail'),
      password: p.success ? undefined : t('auth.errors.passwordTooShort'),
    });
    if (!e.success || !p.success) return;
    setFormError(null);
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email: e.data, password });
    setLoading(false);
    // On success the auth listener updates the session and the router moves on by itself.
    if (error) setFormError(authErrorMessage(error, t));
  }

  return (
    <AuthShell title={t('auth.signInTitle')}>
      <Text variant="caption">{t('auth.tagline')}</Text>
      {formError ? <Notice tone="danger">{formError}</Notice> : null}
      <TextField
        label={t('auth.email')}
        value={email}
        onChangeText={setEmail}
        error={errors.email}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        textContentType="emailAddress"
        returnKeyType="next"
      />
      <TextField
        label={t('auth.password')}
        value={password}
        onChangeText={setPassword}
        error={errors.password}
        secureTextEntry
        autoComplete="current-password"
        textContentType="password"
        returnKeyType="go"
        onSubmitEditing={submit}
      />
      <Link href="/forgot-password" className="self-end py-1">
        <Text variant="caption" className="underline">
          {t('auth.forgot')}
        </Text>
      </Link>
      <Button label={t('auth.signIn')} loading={loading} onPress={submit} />
      <Text variant="caption" className="text-center">
        {t('auth.or')}
      </Text>
      <GoogleButton onError={setFormError} />
      <View className="items-center pt-2">
        <Link href="/sign-up" replace className="py-2">
          <Text className="font-semibold">{t('auth.noAccount')}</Text>
        </Link>
      </View>
    </AuthShell>
  );
}
