import { useColorScheme } from 'nativewind';
import { useState } from 'react';
import { type LayoutChangeEvent, Pressable, View } from 'react-native';
import Svg, { Circle, Line, Path, Text as SvgText } from 'react-native-svg';

import { Text } from '@/components/ui';
import { useSettings } from '@/stores/settings';
import { colors } from '@/theme/tokens';

type Props = {
  kind: 'bar' | 'line';
  labels: string[];
  values: (number | null)[];
  /** Formats a value for the readout, the y-axis and screen readers. */
  format: (v: number) => string;
  /** Short description for screen readers, e.g. "Tonnage par semaine". */
  title: string;
  /** Extra line under the readout for the selected point (e.g. "3 / 4 séances"). */
  detail?: (index: number) => string | null;
  height?: number;
  /** Bars start at 0; lines zoom on the data range unless set. */
  zeroBased?: boolean;
};

const PAD = { top: 12, right: 8, bottom: 22, left: 36 };

/**
 * One series over time: bars for amounts (tonnage, sessions), a line for levels (weight, 1RM).
 * Tap a bar/point to read its value; the last value is selected by default. Thin marks,
 * recessive grid, value text in ink (never the series color). Screen readers get a summary.
 */
export function TimeChart({
  kind,
  labels,
  values,
  format,
  title,
  detail,
  height = 180,
  zeroBased = kind === 'bar',
}: Props) {
  const { colorScheme } = useColorScheme();
  const dark = colorScheme !== 'light';
  const scale = useSettings((s) => s.fontScale);
  const [width, setWidth] = useState(0);
  const lastIndex = findLastIndex(values);
  const [picked, setPicked] = useState<number | null>(null);
  const selected = picked != null && picked < values.length ? picked : lastIndex;

  const mark = dark ? colors.chart.dark : colors.chart.light;
  const grid = dark ? colors.ink[800] : colors.ink[100];
  const axisText = colors.ink[500];

  const present = values.filter((v): v is number => v != null);
  const hasData = present.length > 0;
  let min = zeroBased ? 0 : Math.min(...present);
  let max = Math.max(...present, zeroBased ? 1 : -Infinity);
  if (!hasData) {
    min = 0;
    max = 1;
  } else if (max === min) {
    min = zeroBased ? 0 : min - 1;
    max = max + 1;
  } else if (!zeroBased) {
    const pad = (max - min) * 0.15;
    min -= pad;
    max += pad;
  }

  const plotW = Math.max(0, width - PAD.left - PAD.right);
  const plotH = height - PAD.top - PAD.bottom;
  const n = values.length;
  const slot = n > 0 ? plotW / n : 0;
  const x = (i: number) => PAD.left + slot * i + slot / 2;
  const y = (v: number) => PAD.top + plotH - ((v - min) / (max - min)) * plotH;
  const baseline = PAD.top + plotH;
  const ticks = [min, (min + max) / 2, max];
  const labelEvery = Math.ceil(n / Math.max(1, Math.floor(plotW / 44)));

  const onLayout = (e: LayoutChangeEvent) => setWidth(Math.round(e.nativeEvent.layout.width));
  const selectedValue = selected >= 0 ? values[selected] : null;

  const summary = hasData
    ? `${title}. ${labels
        .map((l, i) => (values[i] != null ? `${l} : ${format(values[i]!)}` : null))
        .filter(Boolean)
        .join(', ')}`
    : title;

  return (
    <View className="gap-2">
      <View className="min-h-12" accessibilityLiveRegion="polite">
        {selected >= 0 && selectedValue != null ? (
          <>
            <Text variant="heading">{format(selectedValue)}</Text>
            <Text variant="caption">
              {labels[selected]}
              {detail?.(selected) ? ` · ${detail(selected)}` : ''}
            </Text>
          </>
        ) : null}
      </View>
      <View onLayout={onLayout} accessible accessibilityLabel={summary} style={{ height }}>
        {width > 0 ? (
          <Svg width={width} height={height}>
            {ticks.map((t, i) => (
              <Line
                key={`g${i}`}
                x1={PAD.left}
                x2={width - PAD.right}
                y1={y(t)}
                y2={y(t)}
                stroke={grid}
                strokeWidth={1}
              />
            ))}
            {hasData
              ? ticks.map((t, i) => (
                  <SvgText
                    key={`t${i}`}
                    x={PAD.left - 6}
                    y={y(t) + 4}
                    fontSize={10 * scale}
                    fill={axisText}
                    textAnchor="end"
                  >
                    {compact(t)}
                  </SvgText>
                ))
              : null}
            {labels.map((l, i) =>
              i % labelEvery === (n - 1) % labelEvery ? (
                <SvgText
                  key={`x${i}`}
                  x={x(i)}
                  y={height - 6}
                  fontSize={10 * scale}
                  fill={i === selected ? (dark ? colors.ink[50] : colors.ink[950]) : axisText}
                  textAnchor="middle"
                >
                  {l}
                </SvgText>
              ) : null,
            )}
            {kind === 'bar'
              ? values.map((v, i) => {
                  if (v == null || v <= 0) return null;
                  const w = Math.max(2, Math.min(28, slot - 4));
                  const top = y(v);
                  return (
                    <Path
                      key={`b${i}`}
                      d={roundedTop(x(i) - w / 2, top, w, baseline - top, Math.min(4, w / 2))}
                      fill={mark}
                      opacity={i === selected ? 1 : 0.55}
                    />
                  );
                })
              : null}
            {kind === 'line' ? (
              <>
                <Path d={linePath(values, x, y)} stroke={mark} strokeWidth={2} fill="none" />
                {values.map((v, i) =>
                  v == null ? null : (
                    <Circle
                      key={`p${i}`}
                      cx={x(i)}
                      cy={y(v)}
                      r={i === selected ? 5 : 3}
                      fill={mark}
                      stroke={dark ? colors.ink[900] : '#FFFFFF'}
                      strokeWidth={2}
                    />
                  ),
                )}
              </>
            ) : null}
            {selected >= 0 ? (
              <Line
                x1={x(selected)}
                x2={x(selected)}
                y1={PAD.top}
                y2={baseline}
                stroke={axisText}
                strokeWidth={1}
                strokeDasharray="3 3"
                opacity={0.6}
              />
            ) : null}
          </Svg>
        ) : null}
        {/* Hit targets wider than the marks: one transparent column per bucket. */}
        {width > 0 ? (
          <View
            className="absolute inset-0 flex-row"
            style={{ paddingLeft: PAD.left, paddingRight: PAD.right }}
          >
            {values.map((v, i) => (
              <Pressable
                key={`o${i}`}
                className="flex-1"
                onPress={() => setPicked(i)}
                accessibilityElementsHidden
                importantForAccessibility="no"
                accessibilityLabel={v != null ? `${labels[i]} : ${format(v)}` : labels[i]}
              />
            ))}
          </View>
        ) : null}
      </View>
    </View>
  );
}

/** Axis ticks stay short: "12 k", "84,5" (the unit is in the readout and the title). */
function compact(v: number): string {
  const abs = Math.abs(v);
  if (abs >= 10000) return `${Math.round(v / 1000)} k`;
  if (abs >= 1000) return `${(v / 1000).toFixed(1).replace('.', ',')} k`;
  if (abs >= 100) return String(Math.round(v));
  return String(Math.round(v * 10) / 10).replace('.', ',');
}

function findLastIndex(values: (number | null)[]) {
  for (let i = values.length - 1; i >= 0; i--) if (values[i] != null) return i;
  return -1;
}

/** Line through the points; a missing value breaks the line (no invented data). */
function linePath(
  values: (number | null)[],
  x: (i: number) => number,
  y: (v: number) => number,
): string {
  let d = '';
  let pen = false;
  values.forEach((v, i) => {
    if (v == null) {
      pen = false;
      return;
    }
    d += `${pen ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)} `;
    pen = true;
  });
  return d.trim();
}

/** Bar with rounded data end, square on the baseline. */
function roundedTop(x: number, y: number, w: number, h: number, r: number): string {
  const rr = Math.min(r, h);
  return `M${x},${y + h} L${x},${y + rr} Q${x},${y} ${x + rr},${y} L${x + w - rr},${y} Q${x + w},${y} ${x + w},${y + rr} L${x + w},${y + h} Z`;
}
