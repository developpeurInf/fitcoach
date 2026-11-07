/** Weight unit helpers. All weights are stored in kg; conversion happens only for display/input. */
export type WeightUnit = 'kg' | 'lb';

const LB_PER_KG = 2.2046226218;

export const kgToLb = (kg: number) => kg * LB_PER_KG;
export const lbToKg = (lb: number) => lb / LB_PER_KG;

/** Converts a stored kg value to the user's unit, rounded to the nearest 0.5. */
export function displayWeight(kg: number, unit: WeightUnit): number {
  const value = unit === 'kg' ? kg : kgToLb(kg);
  return Math.round(value * 2) / 2;
}

/** Converts a value typed in the user's unit back to kg for storage. */
export function toKg(value: number, unit: WeightUnit): number {
  return unit === 'kg' ? value : lbToKg(value);
}

/** "62,5 kg" in French, "62.5 kg" in English (display rounding of displayWeight). */
export function formatWeight(kg: number, unit: WeightUnit, locale = 'fr'): string {
  return `${displayWeight(kg, unit).toLocaleString(locale, { maximumFractionDigits: 1 })} ${unit}`;
}

/** Body weight keeps one decimal (loads use displayWeight's 0.5 steps): "80,9 kg". */
export function formatBodyWeight(kg: number, unit: WeightUnit, locale = 'fr'): string {
  const value = Math.round((unit === 'kg' ? kg : kgToLb(kg)) * 10) / 10;
  return `${value.toLocaleString(locale, { maximumFractionDigits: 1 })} ${unit}`;
}
