import Ionicons from '@expo/vector-icons/Ionicons';
import { useDeferredValue, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, FlatList, Pressable, ScrollView, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, EmptyState, Notice, Text } from '@/components/ui';
import { useExerciseLibrary } from '@/features/exercises/api';
import {
  EQUIPMENT_FILTERS,
  type EquipmentFilter,
  MUSCLE_GROUPS,
  type MuscleGroup,
} from '@/features/exercises/catalog';
import { ExerciseRow } from '@/features/exercises/ExerciseRow';
import { useSettings } from '@/stores/settings';
import { colors } from '@/theme/tokens';

/** Exercise library (§3.4): search by name or muscle, filter by muscle group and equipment. */
export default function ExercisesScreen() {
  const { t } = useTranslation();
  const scale = useSettings((s) => s.fontScale);
  const [query, setQuery] = useState('');
  const [group, setGroup] = useState<MuscleGroup | null>(null);
  const [equipment, setEquipment] = useState<EquipmentFilter | null>(null);
  const deferredQuery = useDeferredValue(query);
  const library = useExerciseLibrary({ query: deferredQuery, group, equipment });
  const items = library.data?.pages.flat() ?? [];

  const header = (
    <View className="gap-3 pb-3">
      <Text variant="title" className="mt-4">
        {t('exercises.title')}
      </Text>
      <View className="min-h-14 flex-row items-center gap-2 rounded-2xl border border-ink-100 bg-white px-4 dark:border-ink-800 dark:bg-ink-900">
        <Ionicons name="search" size={20} color={colors.ink[500]} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder={t('exercises.search')}
          accessibilityLabel={t('exercises.search')}
          placeholderTextColor={colors.ink[500]}
          autoCorrect={false}
          returnKeyType="search"
          className="flex-1 py-3 text-ink-950 dark:text-ink-50"
          style={{ fontSize: 17 * scale }}
        />
        {query ? (
          <Pressable
            onPress={() => setQuery('')}
            accessibilityRole="button"
            accessibilityLabel={t('common.clear')}
            className="h-10 w-10 items-center justify-center"
          >
            <Ionicons name="close-circle" size={20} color={colors.ink[500]} />
          </Pressable>
        ) : null}
      </View>
      <FilterRow
        label={t('exercises.filtersGroup')}
        options={Object.keys(MUSCLE_GROUPS) as MuscleGroup[]}
        value={group}
        onChange={setGroup}
        labelOf={(g) => t(`exercises.groups.${g}`)}
      />
      <FilterRow
        label={t('exercises.filtersEquipment')}
        options={Object.keys(EQUIPMENT_FILTERS) as EquipmentFilter[]}
        value={equipment}
        onChange={setEquipment}
        labelOf={(e) => t(`exercises.equipmentFilters.${e}`)}
      />
    </View>
  );

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-ink-50 dark:bg-ink-950">
      <FlatList
        data={items}
        keyExtractor={(e) => e.id}
        renderItem={({ item }) => <ExerciseRow exercise={item} />}
        ItemSeparatorComponent={() => <View className="h-2" />}
        ListHeaderComponent={header}
        contentContainerClassName="px-5 pb-10"
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        onEndReachedThreshold={0.5}
        onEndReached={() => {
          if (library.hasNextPage && !library.isFetchingNextPage) void library.fetchNextPage();
        }}
        ListEmptyComponent={
          library.isPending ? (
            <ActivityIndicator className="mt-10" color={colors.accent.DEFAULT} />
          ) : library.isError ? (
            <View className="gap-3">
              <Notice tone="danger">{t('common.error')}</Notice>
              <Button
                variant="secondary"
                label={t('common.retry')}
                onPress={() => void library.refetch()}
              />
            </View>
          ) : (
            <EmptyState
              icon="search"
              title={t('exercises.emptyTitle')}
              body={t('exercises.emptyBody')}
            />
          )
        }
        ListFooterComponent={
          library.isFetchingNextPage ? (
            <ActivityIndicator className="mt-4" color={colors.ink[500]} />
          ) : undefined
        }
      />
    </SafeAreaView>
  );
}

function FilterRow<T extends string>({
  label,
  options,
  value,
  onChange,
  labelOf,
}: {
  label: string;
  options: T[];
  value: T | null;
  onChange: (v: T | null) => void;
  labelOf: (v: T) => string;
}) {
  const { t } = useTranslation();
  const chips: (T | null)[] = [null, ...options];
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      accessibilityLabel={label}
      contentContainerClassName="gap-2"
    >
      {chips.map((o) => {
        const selected = o === value;
        return (
          <Pressable
            key={o ?? 'all'}
            onPress={() => onChange(o)}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            className={`min-h-11 justify-center rounded-full px-4 ${
              selected ? 'bg-accent' : 'bg-ink-100 dark:bg-ink-800'
            }`}
          >
            <Text
              className="font-semibold"
              style={selected ? { color: colors.ink[950] } : undefined}
            >
              {o ? labelOf(o) : t('exercises.all')}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
