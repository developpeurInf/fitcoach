import { View } from 'react-native';

type Props = { value: number; label?: string };

export function ProgressBar({ value, label }: Props) {
  const pct = Math.max(0, Math.min(1, value)) * 100;
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(pct) }}
      className="h-2 overflow-hidden rounded-full bg-ink-100 dark:bg-ink-800"
    >
      <View className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
    </View>
  );
}
