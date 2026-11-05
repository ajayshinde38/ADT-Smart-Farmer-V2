import React from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Rect, Text as SvgText, Line, Defs, LinearGradient, Stop } from 'react-native-svg';

export interface VpdChartItem {
  label: string;
  value: number;
}

interface VpdChartProps {
  items: VpdChartItem[];
  language: 'en' | 'mr';
  averageValue?: number;
  height?: number;
}

export const VpdChart: React.FC<VpdChartProps> = ({
  items,
  language,
  averageValue,
  height = 95,
}) => {
  const usable = (items || []).slice(0, 7);
  if (usable.length === 0) return null;

  const mr = language === 'mr';
  const values = usable.map((d) => (typeof d.value === 'number' && Number.isFinite(d.value) ? d.value : 0));
  const maxVal = Math.max(2.5, ...values) + 0.3;
  const avg = averageValue ?? (values.reduce((a, b) => a + b, 0) / Math.max(1, values.length));

  const totalWidth = 320;
  const baselineY = 74;
  const maxBarH = 50;
  const colWidth = totalWidth / usable.length;

  const avgY = baselineY - (avg / maxVal) * maxBarH;

  const formatLabel = (label: string) => {
    if (!label) return '';
    if (mr) {
      return label.replace(/^Now$/i, 'आता');
    }
    return label;
  };

  const getGradientId = (val: number) => {
    if (val > 2.2) return 'vpdBarStress';
    if (val > 1.6) return 'vpdBarModerate';
    if (val >= 0.8) return 'vpdBarOptimal';
    return 'url(#vpdBarLow)';
  };

  const getTextColor = (val: number) => {
    if (val > 2.2) return '#dc2626';
    if (val > 1.6) return '#d97706';
    if (val >= 0.8) return '#065f46';
    return '#0284c7';
  };

  return (
    <View style={[styles.container, { height }]}>
      <Svg width="100%" height={height} viewBox={`0 0 ${totalWidth} ${height}`}>
        <Defs>
          {/* Optimal: 0.8 - 1.6 kPa (Emerald) */}
          <LinearGradient id="vpdBarOptimal" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#059669" stopOpacity="0.95" />
            <Stop offset="1" stopColor="#10b981" stopOpacity="0.75" />
          </LinearGradient>
          {/* Moderate: 1.6 - 2.2 kPa (Warm Amber) */}
          <LinearGradient id="vpdBarModerate" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#d97706" stopOpacity="0.95" />
            <Stop offset="1" stopColor="#f59e0b" stopOpacity="0.75" />
          </LinearGradient>
          {/* Stress: > 2.2 kPa (Rose / Red) */}
          <LinearGradient id="vpdBarStress" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#dc2626" stopOpacity="0.95" />
            <Stop offset="1" stopColor="#ef4444" stopOpacity="0.75" />
          </LinearGradient>
          {/* Low: < 0.8 kPa (Sky Blue) */}
          <LinearGradient id="vpdBarLow" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#0284c7" stopOpacity="0.9" />
            <Stop offset="1" stopColor="#38bdf8" stopOpacity="0.7" />
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

        {/* Bars */}
        {usable.map((item, i) => {
          const val = typeof item.value === 'number' && Number.isFinite(item.value) ? item.value : 0;
          const barH = Math.max(4, (val / maxVal) * maxBarH);
          const barY = baselineY - barH;
          const cx = colWidth * i + colWidth / 2;
          const barWidth = 16;
          const gradId = getGradientId(val);

          return (
            <React.Fragment key={item.label || i}>
              {/* Daily / Hourly VPD value on top of bar */}
              <SvgText
                x={cx}
                y={barY - 4}
                textAnchor="middle"
                fontSize={8.5}
                fontWeight="700"
                fill={getTextColor(val)}
              >
                {val > 0 ? val.toFixed(2) : '—'}
              </SvgText>

              {/* The rounded bar */}
              <Rect
                x={cx - barWidth / 2}
                y={barY}
                width={barWidth}
                height={barH}
                rx={4}
                fill={gradId.startsWith('url(') ? gradId : `url(#${gradId})`}
              />

              {/* Time / Day label */}
              <SvgText
                x={cx}
                y={87}
                textAnchor="middle"
                fontSize={9}
                fontWeight="600"
                fill="#64748b"
              >
                {formatLabel(item.label)}
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

