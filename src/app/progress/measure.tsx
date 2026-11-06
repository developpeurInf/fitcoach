import Ionicons from '@expo/vector-icons/Ionicons';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Image, Platform, Pressable, View } from 'react-native';

import { Button, Notice, Screen, Text, TextField } from '@/components/ui';
import { localDate } from '@/features/program/api';
import { useAddMeasurement } from '@/features/progress/api';
import { BackHeader } from '@/features/progress/BackHeader';
import {
  MEASURE_FIELDS,
  type MeasurementForm,
  validateMeasurement,
} from '@/features/progress/measurement';
import { useSettings } from '@/stores/settings';
import { colors } from '@/theme/tokens';

type Photo = { uri: string; base64: string; mimeType: string };

const LABELS = {
  waist_cm: 'waist',
  chest_cm: 'chest',
  hips_cm: 'hips',
  arm_cm: 'arm',
  thigh_cm: 'thigh',
  body_fat_pct: 'bodyFat',
} as const;

/** New body measurement: weight, girths, body fat, notes and an optional private photo. */
export default function MeasureScreen() {
  const { t } = useTranslation();
  const unit = useSettings((s) => s.unit);
  const add = useAddMeasurement();
  const today = localDate();
  const [form, setForm] = useState<Omit<MeasurementForm, 'hasPhoto'>>({
    measured_on: today,
    weight: '',
    notes: '',
    waist_cm: '',
    chest_cm: '',
    hips_cm: '',
    arm_cm: '',
    thigh_cm: '',
    body_fat_pct: '',
  });
  const [photo, setPhoto] = useState<Photo | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [permissionDenied, setPermissionDenied] = useState(false);

  const set = (key: keyof typeof form) => (value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

  const pick = async (camera: boolean) => {
    const options: ImagePicker.ImagePickerOptions = {
      mediaTypes: ['images'],
      quality: 0.7,
      base64: true,
      allowsEditing: true,
      aspect: [3, 4],
    };
    if (camera) {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) return setPermissionDenied(true);
    }
    const result = camera
      ? await ImagePicker.launchCameraAsync(options)
      : await ImagePicker.launchImageLibraryAsync(options);
    const asset = result.assets?.[0];
    if (result.canceled || !asset?.base64) return;
    setPermissionDenied(false);
    setPhoto({ uri: asset.uri, base64: asset.base64, mimeType: asset.mimeType ?? 'image/jpeg' });
  };

  const save = () => {
    const result = validateMeasurement({ ...form, hasPhoto: !!photo }, unit, today);
    if (!result.ok) return setErrors(result.errors);
    setErrors({});
    add.mutate(
      { ...result.row, photo: photo ? { base64: photo.base64, mimeType: photo.mimeType } : null },
      { onSuccess: () => router.back() },
    );
  };

  const err = (key: string) =>
    errors[key] ? t(errors[key] as 'progress.measure.invalid') : undefined;

  return (
    <Screen>
      <BackHeader title={t('progress.measure.title')} />
      <View className="gap-4">
        <TextField
          label={t('progress.measure.date')}
          value={form.measured_on}
          onChangeText={set('measured_on')}
          error={err('measured_on')}
          placeholder="AAAA-MM-JJ"
          inputMode="numeric"
        />
        <TextField
          label={t('progress.measure.weight')}
          value={form.weight}
          onChangeText={set('weight')}
          error={err('weight')}
          suffix={unit}
          keyboardType="decimal-pad"
        />
        <View className="flex-row flex-wrap gap-3">
          {MEASURE_FIELDS.map((f) => (
            <View key={f} className="min-w-[45%] flex-1">
              <TextField
                label={t(`progress.measure.${LABELS[f]}`)}
                value={form[f]}
                onChangeText={set(f)}
                error={err(f)}
                suffix={f === 'body_fat_pct' ? '%' : 'cm'}
                keyboardType="decimal-pad"
              />
            </View>
          ))}
        </View>
        <TextField
          label={t('progress.measure.notes')}
          value={form.notes}
          onChangeText={set('notes')}
          multiline
          maxLength={500}
        />

        <View className="gap-3">
          <Text variant="heading">{t('progress.measure.photo')}</Text>
          <Text variant="caption">{t('progress.measure.privacy')}</Text>
          {photo ? (
            <View className="gap-2">
              <Image
                source={{ uri: photo.uri }}
                className="aspect-[3/4] w-40 rounded-2xl"
                accessibilityLabel={t('progress.measure.photo')}
              />
              <Pressable
                onPress={() => setPhoto(null)}
                accessibilityRole="button"
                className="min-h-12 flex-row items-center gap-2 self-start"
              >
                <Ionicons name="trash-outline" size={18} color={colors.danger} />
                <Text className="font-semibold">{t('progress.measure.removePhoto')}</Text>
              </Pressable>
            </View>
          ) : (
            <View className="flex-row gap-3">
              <View className="flex-1">
                <Button
                  variant="secondary"
                  label={t('progress.measure.addPhoto')}
                  onPress={() => void pick(false)}
                />
              </View>
              {Platform.OS !== 'web' ? (
                <View className="flex-1">
                  <Button
                    variant="secondary"
                    label={t('progress.measure.takePhoto')}
                    onPress={() => void pick(true)}
                  />
                </View>
              ) : null}
            </View>
          )}
          {permissionDenied ? (
            <Notice tone="warning">{t('progress.measure.permission')}</Notice>
          ) : null}
        </View>

        {errors.form ? <Notice tone="danger">{t('progress.measure.empty')}</Notice> : null}
        {add.isError ? <Notice tone="danger">{t('progress.measure.error')}</Notice> : null}
        <Button label={t('progress.measure.save')} loading={add.isPending} onPress={save} />
      </View>
    </Screen>
  );
}
