import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui';

import { authErrorMessage } from './errors';
import { signInWithGoogle } from './google';

export function GoogleButton({ onError }: { onError: (message: string) => void }) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  return (
    <Button
      variant="secondary"
      label={t('auth.google')}
      loading={loading}
      onPress={async () => {
        setLoading(true);
        try {
          await signInWithGoogle();
        } catch (e) {
          onError(authErrorMessage(e, t));
        } finally {
          setLoading(false);
        }
      }}
    />
  );
}
