import { z } from 'zod';

import { toKg, type WeightUnit } from '@/lib/units';

/** Fields of the measurement form, typed as text by the user ("82,5" accepted). */
export const MEASURE_FIELDS = [
  'waist_cm',
  'chest_cm',
  'hips_cm',
  'arm_cm',
  'thigh_cm',
  'body_fat_pct',
] as const;
export type MeasureField = (typeof MEASURE_FIELDS)[number];

/** Same bounds as the CHECK constraints of body_measurements. */
const BOUNDS: Record<MeasureField | 'weight_kg', [number, number]> = {
  weight_kg: [25, 350],
  waist_cm: [30, 250],
  chest_cm: [30, 250],
  hips_cm: [30, 250],
  arm_cm: [10, 100],
  thigh_cm: [20, 150],
  body_fat_pct: [2, 70],
};

export type MeasurementForm = {
  measured_on: string;
  weight: string;
  notes: string;
  hasPhoto: boolean;
} & Record<MeasureField, string>;

const parse = (s: string) => {
  const t = s.trim().replace(',', '.');
  if (t === '') return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : NaN;
};

/**
 * Validates the form and converts it to a row (weight in kg, one decimal).
 * Returns field → i18n error key, or the row.
 */
export function validateMeasurement(
  form: MeasurementForm,
  unit: WeightUnit,
  today: string,
):
  | {
      ok: true;
      row: { measured_on: string; weight_kg: number | null; notes: string | null } & Record<
        MeasureField,
        number | null
      >;
    }
  | { ok: false; errors: Record<string, string> } {
  const errors: Record<string, string> = {};
  const date = z.iso.date().safeParse(form.measured_on.trim());
  if (!date.success || form.measured_on.trim() > today) {
    errors.measured_on = 'progress.measure.invalidDate';
  }

  const values: Record<string, number | null> = {};
  const weight = parse(form.weight);
  values.weight_kg = weight == null ? null : Math.round(toKg(weight, unit) * 10) / 10;
  for (const f of MEASURE_FIELDS) values[f] = parse(form[f]);

  for (const [field, value] of Object.entries(values)) {
    const [min, max] = BOUNDS[field as keyof typeof BOUNDS];
    if (value != null && (Number.isNaN(value) || value < min || value > max)) {
      errors[field === 'weight_kg' ? 'weight' : field] = 'progress.measure.invalid';
    }
  }
  const empty = Object.values(values).every((v) => v == null);
  if (empty && !form.hasPhoto) errors.form = 'progress.measure.empty';
  if (Object.keys(errors).length) return { ok: false, errors };

  return {
    ok: true,
    row: {
      measured_on: form.measured_on.trim(),
      notes: form.notes.trim() || null,
      ...(values as { weight_kg: number | null } & Record<MeasureField, number | null>),
    },
  };
}
