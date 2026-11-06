import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';

import { ChipGroup, EmptyState, Screen, Text } from '@/components/ui';
import { localDate, useActiveProgram, useProgramWorkouts } from '@/features/program/api';
import { WeekTypeBadge } from '@/features/program/WeekTypeBadge';
import { addDays, formatDayLong, formatMonth, formatWeekdayShort, parseDay } from '@/lib/dates';
import { colors } from '@/theme/tokens';
import type { Workout } from '@/types/models';

type View_ = 'week' | 'month';

export default function ProgramScreen() {
  const { t } = useTranslation();
  const program = useActiveProgram();
  const workouts = useProgramWorkouts(program.data?.id);
  const [view, setView] = useState<View_>('week');
  const today = localDate();

  const weeks = useMemo(() => groupByWeek(workouts.data ?? []), [workouts.data]);
  const currentWeek = workouts.data?.find((w) => w.scheduled_date >= today)?.week_number ?? 1;
  const [selectedWeek, setSelectedWeek] = useState<number | null>(null);
  const week = selectedWeek ?? currentWeek;

  if (program.isPending || (program.data && workouts.isPending)) {
    return (
      <Screen title={t('program.title')}>
        <ActivityIndicator className="mt-16" color={colors.accent.DEFAULT} />
      </Screen>
    );
  }
  if (!program.data) {
    return (
      <Screen title={t('program.title')}>
        <EmptyState icon="calendar" title={t('program.emptyTitle')} body={t('program.emptyBody')} />
      </Screen>
    );
  }

  const p = program.data;
  const weekRows = weeks.get(week) ?? [];

  return (
    <Screen title={t('program.title')}>
      <View className="mb-5 gap-1">
        <Text variant="heading">{p.name}</Text>
        <Text variant="caption">
          {t('program.weeksCount', { count: p.duration_weeks })} ·{' '}
          {t('program.sessionsPerWeek', { count: weeks.get(1)?.length ?? 0 })}
        </Text>
      </View>

      <View className="mb-5">
        <ChipGroup
          options={[
            { value: 'week', label: t('program.weekView') },
            { value: 'month', label: t('program.monthView') },
          ]}
          value={view}
          onChange={(v) => setView(v as View_)}
        />
      </View>

      {view === 'week' ? (
        <View className="gap-4">
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerClassName="gap-2"
          >
            {[...weeks.keys()].map((n) => (
              <Pressable
                key={n}
                onPress={() => setSelectedWeek(n)}
                accessibilityRole="tab"
                accessibilityState={{ selected: n === week }}
                className={`min-h-12 min-w-14 items-center justify-center rounded-2xl border px-3 ${
                  n === week ? 'border-accent bg-accent/15' : 'border-ink-100 dark:border-ink-800'
                }`}
              >
                <Text className="font-bold">{t('program.weekShort', { n })}</Text>
              </Pressable>
            ))}
          </ScrollView>
          {weekRows[0] ? <WeekTypeBadge type={weekRows[0].week_type} /> : null}
          <WeekDays workouts={weekRows} today={today} />
        </View>
      ) : (
        <MonthGrid workouts={workouts.data ?? []} today={today} />
      )}
    </Screen>
  );
}

function groupByWeek(rows: Workout[]) {
  const map = new Map<number, Workout[]>();
  for (const w of rows) map.set(w.week_number, [...(map.get(w.week_number) ?? []), w]);
  return map;
}

/** The 7 days of a program week (from its first session), with rest days shown explicitly. */
function WeekDays({ workouts, today }: { workouts: Workout[]; today: string }) {
  const { t } = useTranslation();
  if (!workouts[0]) return null;
  const days = Array.from({ length: 7 }, (_, i) => addDays(workouts[0]!.scheduled_date, i));
  return (
    <View className="gap-2">
      {days.map((day) => {
        const w = workouts.find((x) => x.scheduled_date === day);
        const isToday = day === today;
        return (
          <Pressable
            key={day}
            disabled={!w}
            onPress={() => w && router.push({ pathname: '/workout/[id]', params: { id: w.id } })}
            accessibilityRole={w ? 'button' : undefined}
            className={`min-h-16 flex-row items-center gap-4 rounded-2xl border px-4 py-3 ${
              isToday ? 'border-accent' : 'border-ink-100 dark:border-ink-800'
            } ${w ? 'bg-white dark:bg-ink-900' : ''}`}
          >
            <View className="w-24">
              <Text variant="caption" className="font-semibold capitalize">
                {isToday ? t('program.today') : formatDayLong(day).split(' ').slice(0, 2).join(' ')}
              </Text>
            </View>
            <View className="flex-1">
              {w ? (
                <>
                  <Text className="font-semibold">{w.title}</Text>
                  <Text variant="caption">
                    {t('workout.minutes', { count: w.estimated_minutes ?? 0 })}
                  </Text>
                </>
              ) : (
                <Text variant="caption">{t('program.rest')}</Text>
              )}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Month calendar (Monday first) with a dot on each training day. */
function MonthGrid({ workouts, today }: { workouts: Workout[]; today: string }) {
  const [offset, setOffset] = useState(0);
  const base = parseDay(today);
  const first = new Date(base.getFullYear(), base.getMonth() + offset, 1);
  const firstIso = localDate(first);
  const daysInMonth = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  const lead = (first.getDay() + 6) % 7; // Monday = 0
  const cells: (string | null)[] = [
    ...Array<null>(lead).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => addDays(firstIso, i)),
  ];
  const byDate = new Map(workouts.map((w) => [w.scheduled_date, w]));
  const weekdayLabels = Array.from({ length: 7 }, (_, i) =>
    formatWeekdayShort(addDays('2026-11-02', i)),
  ); // a Monday

  return (
    <View className="gap-3">
      <View className="flex-row items-center justify-between">
        <Pressable
          onPress={() => setOffset(offset - 1)}
          className="h-12 w-12 items-center justify-center"
          accessibilityRole="button"
          accessibilityLabel="‹"
        >
          <Text variant="heading">‹</Text>
        </Pressable>
        <Text variant="heading" className="capitalize">
          {formatMonth(firstIso)}
        </Text>
        <Pressable
          onPress={() => setOffset(offset + 1)}
          className="h-12 w-12 items-center justify-center"
          accessibilityRole="button"
          accessibilityLabel="›"
        >
          <Text variant="heading">›</Text>
        </Pressable>
      </View>
      <View className="flex-row">
        {weekdayLabels.map((d) => (
          <Text key={d} variant="caption" className="flex-1 text-center capitalize">
            {d}
          </Text>
        ))}
      </View>
      <View className="flex-row flex-wrap">
        {cells.map((day, i) => {
          const w = day ? byDate.get(day) : undefined;
          return (
            <View
              key={day ?? `empty-${i}`}
              style={{ width: `${100 / 7}%` }}
              className="aspect-square p-1"
            >
              {day ? (
                <Pressable
                  disabled={!w}
                  onPress={() =>
                    w && router.push({ pathname: '/workout/[id]', params: { id: w.id } })
                  }
                  accessibilityLabel={w ? `${formatDayLong(day)} : ${w.title}` : formatDayLong(day)}
                  className={`flex-1 items-center justify-center rounded-xl ${
                    day === today ? 'border border-accent' : ''
                  } ${w ? 'bg-accent/15' : ''}`}
                >
                  <Text className={w ? 'font-bold' : ''}>{parseDay(day).getDate()}</Text>
                  {w ? <View className="mt-1 h-1.5 w-1.5 rounded-full bg-accent" /> : null}
                </Pressable>
              ) : null}
            </View>
          );
        })}
      </View>
    </View>
  );
}
