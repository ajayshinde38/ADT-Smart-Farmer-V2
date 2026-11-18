import React, { useState } from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import Svg, { Rect, Text as SvgText, Line, Defs, LinearGradient, Stop } from 'react-native-svg';
import { AppText as Text, Icon } from './ui';

interface DayWaterDemand {
  date: string;
  water_demand_liters?: number | null;
  rainfall_mm?: number | null;
  et0_mm?: number | null;
  etc_mm?: number | null;
  temp_max_c?: number | null;
  temp_min_c?: number | null;
}

interface WaterDemandChartProps {
  forecastDays: DayWaterDemand[];
  pastDays?: DayWaterDemand[];
  areaAcres?: number | null;
  areaM2?: number | null;
  language: 'en' | 'mr';
  height?: number;
}

export const WaterDemandChart: React.FC<WaterDemandChartProps> = ({
  forecastDays,
  pastDays,
  areaAcres,
  areaM2,
  language,
  height = 135,
}) => {
  const mr = language === 'mr';
  const hasPastData = Boolean(pastDays && pastDays.length > 0);
  const [activeTab, setActiveTab] = useState<'forecast' | 'past'>('forecast');

  // Select dataset based on active tab (or fallback to forecast)
  const currentList = (activeTab === 'past' && hasPastData ? pastDays : forecastDays) || [];
  const usable = currentList.slice(0, 7);

  if (usable.length === 0) return null;

  // Resolve area in m2 (1 acre = 4046.856 m2)
  const plotAreaM2 = areaM2 || (areaAcres ? areaAcres * 4046.8564 : 4046.8564);

  // Extract daily water volume in Liters
  const items = usable.map((d) => {
    let liters = d.water_demand_liters;
    if (liters == null || !Number.isFinite(liters)) {
      // Fallback compute if field was missing: (ETc - effective_rain) * areaM2 (FAO-56 standard)
      const etc = d.etc_mm ?? ((d.et0_mm ?? 4.5) * 0.95);
      const rain = d.rainfall_mm ?? 0;
      const effectiveRain = rain > 1.0 ? rain * 0.80 : 0.0;
      const netMm = Math.max(0, etc - effectiveRain);
      liters = Math.round(netMm * plotAreaM2);
    }
    return {
      date: d.date,
      liters: Math.max(0, liters),
      rain: d.rainfall_mm ?? 0,
      et0: d.et0_mm ?? 0,
    };
  });

  const waterValues = items.map((x) => x.liters);
  const maxVal = Math.max(1000, ...waterValues) * 1.18; // Headroom for labels
  const totalLiters = waterValues.reduce((a, b) => a + b, 0);
  const avgLiters = Math.round(totalLiters / Math.max(1, items.length));

  const totalWidth = 320;
  const baselineY = 96;
  const maxBarH = 62;
  const colWidth = totalWidth / items.length;
  const avgY = baselineY - (avgLiters / maxVal) * maxBarH;

  const formatDayName = (dateStr: string) => {
    try {
      const d = new Date(`${dateStr}T12:00:00+05:30`);
      return d.toLocaleDateString(mr ? 'mr-IN' : 'en-IN', { weekday: 'short' });
    } catch {
      return dateStr.slice(5);
    }
  };

  const formatLitersShort = (val: number) => {
    if (val >= 100000) {
      return `${(val / 1000).toFixed(0)}k`;
    }
    if (val >= 1000) {
      return `${(val / 1000).toFixed(1)}k`;
    }
    return `${val}`;
  };

  return (
    <View style={styles.card}>
      {/* Tab Switcher: Past Intake vs Next Demand */}
      {hasPastData && (
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'past' && styles.tabButtonActive]}
            onPress={() => setActiveTab('past')}
            activeOpacity={0.8}
          >
            <Icon
              name="history"
              size={13}
              color={activeTab === 'past' ? '#ffffff' : '#047857'}
            />
            <Text style={[styles.tabText, activeTab === 'past' && styles.tabTextActive]}>
              {mr ? 'मागील ७ दिवस (खप)' : 'Past 7 Days (Intake)'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'forecast' && styles.tabButtonActive]}
            onPress={() => setActiveTab('forecast')}
            activeOpacity={0.8}
          >
            <Icon
              name="water-drop"
              size={13}
              color={activeTab === 'forecast' ? '#ffffff' : '#047857'}
            />
            <Text style={[styles.tabText, activeTab === 'forecast' && styles.tabTextActive]}>
              {mr ? 'पुढील ७ दिवस (मागणी)' : 'Next 7 Days (Demand)'}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Summary Header */}
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.headerTitle}>
            {activeTab === 'past'
              ? (mr ? 'मागील आठवड्याचा पाणी वापर' : 'Past 7 Days Water Intake')
              : (mr ? 'पुढील आठवड्याची पाण्याची गरज' : '7-Day Water Demand Outlook')}
          </Text>
          <Text style={styles.headerSubtitle}>
            {mr ? 'दैनिक सरासरी: ' : 'Daily average: '}
            <Text style={styles.headerSubtitleBold}>{avgLiters.toLocaleString()} L/{mr ? 'दिवस' : 'day'}</Text>
          </Text>
        </View>
        <View style={styles.totalBadge}>
          <Text style={styles.totalBadgeLabel}>
            {mr ? 'एकूण' : 'Total'}
          </Text>
          <Text style={styles.totalBadgeValue}>
            {(totalLiters / 1000).toFixed(1)}k L
          </Text>
          <Text style={styles.totalBadgeM3}>
            ~{Math.round(totalLiters / 1000)} m³
          </Text>
        </View>
      </View>

      {/* SVG Bar Chart */}
      <View style={[styles.chartContainer, { height }]}>
        <Svg width="100%" height={height} viewBox={`0 0 ${totalWidth} ${height}`}>
          <Defs>
            {/* Primary Water Gradient */}
            <LinearGradient id="waterDemandBar" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#0284c7" stopOpacity="0.95" />
              <Stop offset="1" stopColor="#38bdf8" stopOpacity="0.75" />
            </LinearGradient>
            {/* Rain Saved Water Gradient */}
            <LinearGradient id="waterDemandRain" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#10b981" stopOpacity="0.9" />
              <Stop offset="1" stopColor="#6ee7b7" stopOpacity="0.7" />
            </LinearGradient>
          </Defs>

          {/* Baseline */}
          <Line
            x1={10}
            y1={baselineY}
            x2={totalWidth - 10}
            y2={baselineY}
            stroke="#cbd5e1"
            strokeWidth={1}
          />

          {/* Average dashed reference line */}
          {avgLiters > 0 && (
            <Line
              x1={8}
              y1={avgY}
              x2={totalWidth - 8}
              y2={avgY}
              stroke="#0284c7"
              strokeWidth={1.2}
              strokeDasharray="4,3"
              strokeOpacity={0.6}
            />
          )}

          {/* Daily Bars */}
          {items.map((item, i) => {
            const barH = Math.max(6, (item.liters / maxVal) * maxBarH);
            const barY = baselineY - barH;
            const cx = colWidth * i + colWidth / 2;
            const barWidth = 18;
            const hasRain = item.rain > 0.5;

            return (
              <React.Fragment key={item.date || i}>
                {/* Liters text above bar */}
                <SvgText
                  x={cx}
                  y={barY - 4}
                  textAnchor="middle"
                  fontSize={8.5}
                  fontWeight="700"
                  fill="#0369a1"
                >
                  {formatLitersShort(item.liters)}
                </SvgText>

                {/* Main Bar */}
                <Rect
                  x={cx - barWidth / 2}
                  y={barY}
                  width={barWidth}
                  height={barH}
                  rx={4}
                  ry={4}
                  fill={hasRain ? 'url(#waterDemandRain)' : 'url(#waterDemandBar)'}
                />

                {/* Rain indicator dot if rain saved irrigation */}
                {hasRain && (
                  <SvgText
                    x={cx}
                    y={barY + Math.min(10, barH / 2)}
                    textAnchor="middle"
                    fontSize={7.5}
                    fontWeight="800"
                    fill="#ffffff"
                  >
                    🌧️
                  </SvgText>
                )}

                {/* Day Name */}
                <SvgText
                  x={cx}
                  y={baselineY + 14}
                  textAnchor="middle"
                  fontSize={9.5}
                  fontWeight="600"
                  fill="#475569"
                >
                  {formatDayName(item.date)}
                </SvgText>
              </React.Fragment>
            );
          })}
        </Svg>
      </View>

      {/* Legend & Plot Area Reference */}
      <View style={styles.legendRow}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#0284c7' }]} />
          <Text style={styles.legendText}>
            {mr ? 'पाण्याची गरज (लिटर/दिवस)' : 'Irrigation Required (L/day)'}
          </Text>
        </View>
        <Text style={styles.areaBadge}>
          {areaAcres != null ? `${areaAcres.toFixed(2)} ${mr ? 'एकर' : 'Acres'}` : 'Plot'}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#f0fdf4',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#bbf7d0',
    padding: 12,
    marginTop: 10,
    marginBottom: 4,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#dcfce7',
    borderRadius: 9,
    padding: 3,
    marginBottom: 10,
    gap: 4,
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 7,
    gap: 5,
  },
  tabButtonActive: {
    backgroundColor: '#059669',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  tabText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#047857',
  },
  tabTextActive: {
    color: '#ffffff',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
    paddingHorizontal: 4,
  },
  headerTitle: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#064e3b',
  },
  headerSubtitle: {
    fontSize: 11,
    color: '#047857',
    marginTop: 1,
  },
  headerSubtitleBold: {
    fontWeight: '800',
    color: '#0284c7',
  },
  totalBadge: {
    backgroundColor: '#e0f2fe',
    borderWidth: 1,
    borderColor: '#bae6fd',
    borderRadius: 9,
    paddingVertical: 4,
    paddingHorizontal: 8,
    alignItems: 'flex-end',
  },
  totalBadgeLabel: {
    fontSize: 9.5,
    fontWeight: '600',
    color: '#0369a1',
  },
  totalBadgeValue: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#0284c7',
  },
  totalBadgeM3: {
    fontSize: 9,
    color: '#0284c7',
  },
  chartContainer: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 4,
    paddingHorizontal: 4,
    borderTopWidth: 1,
    borderTopColor: '#dcfce7',
    marginTop: 2,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 10,
    color: '#047857',
    fontWeight: '600',
  },
  areaBadge: {
    fontSize: 10,
    color: '#065f46',
    fontWeight: '700',
    backgroundColor: '#dcfce7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
});
