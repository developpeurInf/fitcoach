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
