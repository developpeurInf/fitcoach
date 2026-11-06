import i18n from '@/i18n';

/** Parses a YYYY-MM-DD date as a local calendar day (no timezone shift). */
export const parseDay = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y!, m! - 1, d!);
};

const fmt = (opts: Intl.DateTimeFormatOptions) => (iso: string) =>
  new Intl.DateTimeFormat(i18n.language, opts).format(parseDay(iso));

/** "Lundi 9 novembre" (first letter capitalised: French weekdays are lowercase). */
const dayLong = fmt({ weekday: 'long', day: 'numeric', month: 'long' });
export const formatDayLong = (iso: string) => capitalize(dayLong(iso));
/** "lun." */
export const formatWeekdayShort = fmt({ weekday: 'short' });
/** "novembre 2026" */
export const formatMonth = fmt({ month: 'long', year: 'numeric' });

export function addDays(iso: string, days: number): string {
  const d = parseDay(iso);
  d.setDate(d.getDate() + days);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
