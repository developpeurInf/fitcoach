import { useTranslation } from 'react-i18next';

/** French labels of library tags; unknown tags are shown as they are. */
export function useLabels() {
  const { t, i18n } = useTranslation();
  return {
    muscle: (tag: string) =>
      i18n.exists(`exercises.muscles.${tag}`)
        ? t(`exercises.muscles.${tag}` as 'exercises.muscles.chest')
        : tag,
    equipment: (tag: string) =>
      i18n.exists(`exercises.equipmentTags.${tag}`)
        ? t(`exercises.equipmentTags.${tag}` as 'exercises.equipmentTags.barbell')
        : tag,
  };
}
