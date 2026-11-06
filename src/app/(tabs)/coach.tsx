import { useTranslation } from 'react-i18next';

import { EmptyState, Screen } from '@/components/ui';

// Placeholder screen: real content arrives in a later phase.
export default function CoachScreen() {
  const { t } = useTranslation();
  return (
    <Screen title={t('coach.title')}>
      <EmptyState icon="chatbubbles" title={t('coach.emptyTitle')} body={t('coach.emptyBody')} />
    </Screen>
  );
}
