import { getLocales } from 'expo-localization';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import en from './locales/en.json';
import fr from './locales/fr.json';

export const resources = { fr: { translation: fr }, en: { translation: en } } as const;
export type AppLanguage = keyof typeof resources;

/**
 * The interface is French by default (spec §6). Other languages are opt-in from Settings;
 * `deviceLanguage` is exposed so Settings can suggest the device language when we ship it.
 */
const deviceCode = getLocales()[0]?.languageCode ?? 'fr';
export const deviceLanguage: AppLanguage =
  deviceCode in resources ? (deviceCode as AppLanguage) : 'fr';
const lng: AppLanguage = 'fr';

// eslint-disable-next-line import/no-named-as-default-member -- i18next's documented instance API
void i18n.use(initReactI18next).init({
  resources,
  lng,
  fallbackLng: 'fr',
  interpolation: { escapeValue: false },
});

export default i18n;
