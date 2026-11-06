import { Text as RNText, type TextProps } from 'react-native';

import { useSettings } from '@/stores/settings';

const SIZES = { title: 32, heading: 22, body: 16, caption: 13 } as const;
type Variant = keyof typeof SIZES;

const VARIANT_CLASS: Record<Variant, string> = {
  title: 'font-extrabold text-ink-950 dark:text-ink-50',
  heading: 'font-bold text-ink-950 dark:text-ink-50',
  body: 'text-ink-900 dark:text-ink-100',
  caption: 'text-ink-500 dark:text-ink-300',
};

type Props = TextProps & { variant?: Variant; className?: string };

/**
 * Text that honours the user's font-scale preference on top of the OS setting.
 * Size comes from the variant so the scale applies uniformly.
 */
export function Text({ variant = 'body', className = '', style, ...rest }: Props) {
  const scale = useSettings((s) => s.fontScale);
  const fontSize = SIZES[variant] * scale;
  return (
    <RNText
      className={`${VARIANT_CLASS[variant]} ${className}`}
      style={[{ fontSize, lineHeight: fontSize * 1.3 }, style]}
      {...rest}
    />
  );
}
