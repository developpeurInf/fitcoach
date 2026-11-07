import Constants from 'expo-constants';
import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Switch, View } from 'react-native';

import {
  Button,
  ChipGroup,
  Notice,
  Screen,
  Segmented,
  Sheet,
  Text,
  TextField,
} from '@/components/ui';
import { collectUserData, saveExport } from '@/features/account/export';
import { useAuth } from '@/features/auth/store';
import { EQUIPMENT, GOALS, SESSION_MINUTES } from '@/features/onboarding/schema';
import { useProfile, useUpdateProfile } from '@/features/profile/api';
import { REMINDER_TIMES } from '@/features/reminders/logic';
import { callFunction } from '@/lib/functions';
import { ensurePermission, notificationsSupported } from '@/lib/notifications';
import { queryClient } from '@/lib/query-client';
import { supabase } from '@/lib/supabase';
import { type FontScale, type ThemePreference, useSettings } from '@/stores/settings';
import { colors } from '@/theme/tokens';
import type { Profile } from '@/types/models';

const DAYS = [1, 2, 3, 4, 5, 6] as const;
const FONT_SCALES: FontScale[] = [1, 1.15, 1.3];

/** Profile, display, reminders, data export and account deletion (GDPR), sign-out. */
export default function SettingsScreen() {
  const { t } = useTranslation();
  const email = useAuth((s) => s.session?.user.email);
  const profile = useProfile();

  return (
    <Screen title={t('settings.title')}>
      <View className="gap-8">
        {profile.data ? <ProfileSection profile={profile.data} /> : null}
        <DisplaySection />
        <RemindersSection />
        <DataSection />
        <Section title={t('settings.account')}>
          {email ? <Text variant="caption">{t('settings.signedInAs', { email })}</Text> : null}
          <Button
            variant="secondary"
            label={t('auth.signOut')}
            onPress={async () => {
              await supabase.auth.signOut();
              queryClient.clear();
            }}
          />
          <Button variant="secondary" label={t('common.close')} onPress={() => router.back()} />
          <Text variant="caption" className="text-center">
            {t('settings.about', { version: Constants.expoConfig?.version ?? '' })}
          </Text>
        </Section>
      </View>
    </Screen>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View className="gap-3">
      <Text variant="heading" accessibilityRole="header">
        {title}
      </Text>
      {children}
    </View>
  );
}

function Label({ children }: { children: string }) {
  return (
    <Text variant="caption" className="font-semibold uppercase tracking-wide">
      {children}
    </Text>
  );
}

function ProfileSection({ profile }: { profile: Profile }) {
  const { t } = useTranslation();
  const update = useUpdateProfile();
  const [firstName, setFirstName] = useState(profile.first_name ?? '');
  const [goal, setGoal] = useState(profile.main_goal);
  const [days, setDays] = useState(profile.days_per_week);
  const [minutes, setMinutes] = useState(profile.session_minutes);
  const [equipment, setEquipment] = useState<string[]>(profile.equipment);
  const [saved, setSaved] = useState(false);
  const toggle = (v: string) =>
    setEquipment((list) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]));

  return (
    <Section title={t('settings.profile')}>
      <TextField
        label={t('settings.firstName')}
        value={firstName}
        onChangeText={setFirstName}
        maxLength={40}
        autoComplete="given-name"
      />
      <Label>{t('settings.goal')}</Label>
      <ChipGroup
        options={GOALS.map((v) => ({ value: v, label: t(`onboarding.options.goal.${v}`) }))}
        value={goal ?? undefined}
        onChange={setGoal}
        accessibilityLabel={t('settings.goal')}
      />
      <Label>{t('settings.days')}</Label>
      <ChipGroup
        options={DAYS.map((v) => ({ value: v, label: String(v) }))}
        value={days ?? undefined}
        onChange={setDays}
        accessibilityLabel={t('settings.days')}
      />
      <Label>{t('settings.minutes')}</Label>
      <ChipGroup
        options={SESSION_MINUTES.map((v) => ({ value: v, label: `${v} min` }))}
        value={minutes ?? undefined}
        onChange={setMinutes}
        accessibilityLabel={t('settings.minutes')}
      />
      <Label>{t('settings.equipment')}</Label>
      <ChipGroup
        multiple
        options={EQUIPMENT.map((v) => ({
          value: v,
          label: t(`onboarding.options.equipment.${v}`),
        }))}
        value={equipment}
        onChange={toggle}
        accessibilityLabel={t('settings.equipment')}
      />
      {update.isError ? <Notice tone="danger">{t('common.error')}</Notice> : null}
      {saved && !update.isPending ? <Notice>{t('settings.saved')}</Notice> : null}
      <Button
        label={t('settings.save')}
        loading={update.isPending}
        disabled={equipment.length === 0}
        onPress={() => {
          setSaved(false);
          update.mutate(
            {
              first_name: firstName.trim() || null,
              main_goal: goal,
              days_per_week: days,
              session_minutes: minutes,
              equipment,
            },
            { onSuccess: () => setSaved(true) },
          );
        }}
      />
    </Section>
  );
}

function DisplaySection() {
  const { t } = useTranslation();
  const { theme, unit, fontScale, setTheme, setUnit, setFontScale } = useSettings();
  return (
    <Section title={t('settings.display')}>
      <Label>{t('settings.theme')}</Label>
      <Segmented<ThemePreference>
        accessibilityLabel={t('settings.theme')}
        options={(['dark', 'light', 'system'] as const).map((v) => ({
          value: v,
          label: t(`settings.themes.${v}`),
        }))}
        value={theme}
        onChange={setTheme}
      />
      <Label>{t('settings.unit')}</Label>
      <Segmented
        accessibilityLabel={t('settings.unit')}
        options={[
          { value: 'kg', label: 'kg' },
          { value: 'lb', label: 'lb' },
        ]}
        value={unit}
        onChange={setUnit}
      />
      <Label>{t('settings.fontScale')}</Label>
      <Segmented
        accessibilityLabel={t('settings.fontScale')}
        options={FONT_SCALES.map((v) => ({
          value: String(v) as '1' | '1.15' | '1.3',
          label: t(`settings.fontScales.${String(v) as '1' | '1.15' | '1.3'}`),
        }))}
        value={String(fontScale) as '1' | '1.15' | '1.3'}
        onChange={(v) => setFontScale(Number(v) as FontScale)}
      />
    </Section>
  );
}

function RemindersSection() {
  const { t } = useTranslation();
  const { reminders, reminderTime, setReminders, setReminderTime } = useSettings();
  const [denied, setDenied] = useState(false);
  return (
    <Section title={t('reminders.title')}>
      {!notificationsSupported ? (
        <Text variant="caption">{t('reminders.webOnly')}</Text>
      ) : (
        <>
          <View className="min-h-14 flex-row items-center justify-between gap-3">
            <Text className="flex-1">{t('reminders.enable')}</Text>
            <Switch
              accessibilityLabel={t('reminders.enable')}
              value={reminders}
              trackColor={{ true: colors.accent.DEFAULT, false: colors.ink[500] }}
              onValueChange={async (on) => {
                if (on && !(await ensurePermission())) return setDenied(true);
                setDenied(false);
                setReminders(on);
              }}
            />
          </View>
          {denied ? <Notice tone="warning">{t('reminders.denied')}</Notice> : null}
          {reminders ? (
            <>
              <Label>{t('reminders.time')}</Label>
              <ChipGroup
                options={REMINDER_TIMES.map((v) => ({ value: v, label: v }))}
                value={reminderTime}
                onChange={setReminderTime}
                accessibilityLabel={t('reminders.time')}
              />
            </>
          ) : null}
        </>
      )}
    </Section>
  );
}

function DataSection() {
  const { t } = useTranslation();
  const [exporting, setExporting] = useState(false);
  const [exportState, setExportState] = useState<'done' | 'error' | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [word, setWord] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState(false);
  const confirmWord = t('settings.deleteConfirmWord');

  return (
    <Section title={t('settings.data')}>
      <Text variant="caption">{t('settings.dataBody')}</Text>
      {exportState === 'done' ? <Notice>{t('settings.exported')}</Notice> : null}
      {exportState === 'error' ? <Notice tone="danger">{t('settings.exportError')}</Notice> : null}
      <Button
        variant="secondary"
        label={t('settings.export')}
        loading={exporting}
        onPress={async () => {
          setExporting(true);
          setExportState(null);
          try {
            await saveExport(await collectUserData());
            setExportState('done');
          } catch {
            setExportState('error');
          } finally {
            setExporting(false);
          }
        }}
      />
      <Button
        variant="secondary"
        label={t('settings.delete')}
        onPress={() => setConfirming(true)}
      />

      <Sheet
        visible={confirming}
        title={t('settings.deleteTitle')}
        onClose={() => (setConfirming(false), setWord(''), setDeleteError(false))}
      >
        <Notice tone="danger">{t('settings.deleteBody')}</Notice>
        <TextField
          label={t('settings.deleteConfirmLabel')}
          value={word}
          onChangeText={setWord}
          autoCapitalize="characters"
          autoCorrect={false}
        />
        {deleteError ? <Text variant="error">{t('settings.deleteError')}</Text> : null}
        <Button
          variant="danger"
          label={t('settings.delete')}
          loading={deleting}
          disabled={word.trim().toUpperCase() !== confirmWord}
          onPress={async () => {
            setDeleting(true);
            setDeleteError(false);
            try {
              await callFunction('delete-account', { confirm: 'SUPPRIMER' });
              await supabase.auth.signOut({ scope: 'local' });
              queryClient.clear();
            } catch {
              setDeleteError(true);
              setDeleting(false);
            }
          }}
        />
      </Sheet>
    </Section>
  );
}
