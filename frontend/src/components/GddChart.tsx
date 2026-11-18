import React from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Rect, Text as SvgText, Line, Defs, LinearGradient, Stop } from 'react-native-svg';

interface DayGdd {
  date: string;
  gdd?: number;
  temp_max_c?: number;
  temp_min_c?: number;
}

interface GddChartProps {
  days: DayGdd[];
  language: 'en' | 'mr';
  averageGdd?: number;
  height?: number;
}

export const GddChart: React.FC<GddChartProps> = ({
  days,
  language,
  averageGdd,
  height = 95,
}) => {
  const usable = (days || []).slice(0, 7);
  if (usable.length === 0) return null;

  const mr = language === 'mr';
  const gddValues = usable.map((d) => (typeof d.gdd === 'number' && Number.isFinite(d.gdd) ? d.gdd : 0));
  const maxVal = Math.max(12, ...gddValues) + 1.5;
  const avg = averageGdd ?? (gddValues.reduce((a, b) => a + b, 0) / Math.max(1, gddValues.length));

  const totalWidth = 320;
  const baselineY = 74;
  const maxBarH = 50;
  const colWidth = totalWidth / usable.length;

  const avgY = baselineY - (avg / maxVal) * maxBarH;

  const formatDay = (dateStr: string) => {
    try {
      const d = new Date(`${dateStr}T12:00:00+05:30`);
      return d.toLocaleDateString(mr ? 'mr-IN' : 'en-IN', { weekday: 'short' });
    } catch {
      return dateStr.slice(5);
    }
  };

  return (
    <View style={[styles.container, { height }]}>
      <Svg width="100%" height={height} viewBox={`0 0 ${totalWidth} ${height}`}>
        <Defs>
          <LinearGradient id="gddBarOptimal" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#059669" stopOpacity="0.95" />
            <Stop offset="1" stopColor="#10b981" stopOpacity="0.75" />
          </LinearGradient>
          <LinearGradient id="gddBarSubtle" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#34d399" stopOpacity="0.9" />
            <Stop offset="1" stopColor="#6ee7b7" stopOpacity="0.65" />
          </LinearGradient>
        </Defs>

        {/* Baseline */}
        <Line x1={10} y1={baselineY} x2={totalWidth - 10} y2={baselineY} stroke="#e2e8f0" strokeWidth={1} />

        {/* Average dashed reference line */}
        {avg > 0 && (
          <Line
            x1={8}
            y1={avgY}
            x2={totalWidth - 8}
            y2={avgY}
            stroke="#059669"
            strokeWidth={1.2}
            strokeDasharray="4,3"
            strokeOpacity={0.5}
          />
        )}

        {/* Daily Bars */}
        {usable.map((day, i) => {
          const val = typeof day.gdd === 'number' && Number.isFinite(day.gdd) ? day.gdd : 0;
          const barH = Math.max(4, (val / maxVal) * maxBarH);
          const barY = baselineY - barH;
          const cx = colWidth * i + colWidth / 2;
          const barWidth = 16;
          const isAboveAvg = val >= avg;

          return (
            <React.Fragment key={day.date || i}>
              {/* Daily GDD value on top of bar */}
              <SvgText
                x={cx}
                y={barY - 4}
                textAnchor="middle"
                fontSize={9}
                fontWeight="700"
                fill={isAboveAvg ? '#065f46' : '#047857'}
              >
                {val > 0 ? val.toFixed(1) : '—'}
              </SvgText>

              {/* The rounded bar */}
              <Rect
                x={cx - barWidth / 2}
                y={barY}
                width={barWidth}
                height={barH}
                rx={4}
                fill={isAboveAvg ? 'url(#gddBarOptimal)' : 'url(#gddBarSubtle)'}
              />

              {/* Day label */}
              <SvgText
                x={cx}
                y={87}
                textAnchor="middle"
                fontSize={9.5}
                fontWeight="600"
                fill="#64748b"
              >
                {formatDay(day.date)}
              </SvgText>
            </React.Fragment>
          );
        })}
      </Svg>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
