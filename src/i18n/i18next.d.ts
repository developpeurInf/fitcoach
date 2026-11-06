import 'i18next';
import type fr from './locales/fr.json';

// Typed translation keys: t('today.title') is checked at compile time.
declare module 'i18next' {
  interface CustomTypeOptions {
    resources: { translation: typeof fr };
  }
}
