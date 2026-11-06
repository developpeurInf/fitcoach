import { useTranslation } from 'react-i18next';

import { EmptyState, Screen } from '@/components/ui';

// Placeholder screen: real content arrives in a later phase.
export default function TodayScreen() {
  const { t } = useTranslation();
  return (
    <Screen title={t('today.title')}>
      <EmptyState icon="flash" title={t('today.emptyTitle')} body={t('today.emptyBody')} />
    </Screen>
  );
}
