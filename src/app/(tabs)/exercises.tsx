import { useTranslation } from 'react-i18next';

import { EmptyState, Screen } from '@/components/ui';

// Placeholder screen: real content arrives in a later phase.
export default function ExercisesScreen() {
  const { t } = useTranslation();
  return (
    <Screen title={t('exercises.title')}>
      <EmptyState
        icon="barbell"
        title={t('exercises.emptyTitle')}
        body={t('exercises.emptyBody')}
      />
    </Screen>
  );
}
