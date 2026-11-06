import { useTranslation } from 'react-i18next';

import { EmptyState, Screen } from '@/components/ui';

// Placeholder screen: real content arrives in a later phase.
export default function ProgramScreen() {
  const { t } = useTranslation();
  return (
    <Screen title={t('program.title')}>
      <EmptyState icon="calendar" title={t('program.emptyTitle')} body={t('program.emptyBody')} />
    </Screen>
  );
}
