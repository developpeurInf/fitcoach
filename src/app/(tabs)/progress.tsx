import { useTranslation } from 'react-i18next';

import { EmptyState, Screen } from '@/components/ui';

// Placeholder screen: real content arrives in a later phase.
export default function ProgressScreen() {
  const { t } = useTranslation();
  return (
    <Screen title={t('progress.title')}>
      <EmptyState
        icon="trending-up"
        title={t('progress.emptyTitle')}
        body={t('progress.emptyBody')}
      />
    </Screen>
  );
}
