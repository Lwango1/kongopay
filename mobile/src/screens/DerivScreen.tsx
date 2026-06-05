import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { LineChart } from 'react-native-chart-kit';
import { COLORS } from '../constants/theme';
import Card from '../components/ui/Card';
import { fetchDerivState, fetchSpikePrediction, INDICES } from '../services/deriv';
import type { DerivState, SpikeMap } from '../services/deriv';

const chartWidth = Dimensions.get('window').width - 48;

function formatChartData(history: number[]) {
  const labels = history.filter((_, i) => i % Math.max(1, Math.floor(history.length / 6)) === 0).map(() => '');
  return {
    labels: labels,
    datasets: [{ data: history.length > 0 ? history : [0] }],
  };
}

export default function DerivScreen() {
  const [state, setState] = useState<DerivState | null>(null);
  const [spikes, setSpikes] = useState<SpikeMap>({});
  const [activeKey, setActiveKey] = useState('BOOM_500');
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const { indices } = await fetchDerivState();
      setState(indices);

      const spikePromises = INDICES.map(async (idx) => {
        const key = `${idx.type}_${idx.number}`;
        const prediction = await fetchSpikePrediction(idx.type, idx.number);
        if (prediction) return [key, prediction] as const;
        return null;
      });
      const results = await Promise.all(spikePromises);
      const spikeMap: SpikeMap = {};
      for (const r of results) {
        if (r) spikeMap[r[0]] = r[1];
      }
      setSpikes(spikeMap);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 2000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const currentIdx = INDICES.find((i) => `${i.type}_${i.number}` === activeKey);
  const currentData = state?.[activeKey];
  const currentSpike = spikes[activeKey];

  const chartData = currentData
    ? formatChartData(currentData.history.slice(-60))
    : { labels: [], datasets: [{ data: [0] }] };

  return (
    <ScrollView
      style={styles.page}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={fetchData} tintColor={COLORS.primary} />
      }
    >
      {loading ? (
        <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 40 }} />
      ) : (
        <>
          <View style={styles.header}>
            <Text style={styles.title}>Deriv Synthétiques</Text>
            <Text style={styles.subtitle}>Boom & Crash en temps réel</Text>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.indicesRow}>
            {INDICES.map((idx) => {
              const key = `${idx.type}_${idx.number}`;
              const isActive = key === activeKey;
              const change = state?.[key]?.change24h ?? 0;
              const spike = spikes[key];
              return (
                <TouchableOpacity
                  key={key}
                  style={[styles.indexBtn, isActive && { backgroundColor: idx.color + '30', borderColor: idx.color }]}
                  onPress={() => setActiveKey(key)}
                >
                  <View style={styles.indexBtnContent}>
                    <Text style={[styles.indexLabel, isActive && { color: '#fff' }]}>{idx.label}</Text>
                    {state?.[key] && (
                      <Text style={[styles.indexChange, { color: change >= 0 ? COLORS.success : COLORS.danger }]}>
                        {change >= 0 ? '+' : ''}{change.toFixed(1)}%
                      </Text>
                    )}
                    {spike?.isSpikeImminent && (
                      <View style={styles.spikeDot} />
                    )}
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <Card style={styles.chartCard}>
            <View style={styles.chartHeader}>
              <View style={styles.chartTitleRow}>
                <View style={[styles.colorDot, { backgroundColor: currentIdx?.color }]} />
                <Text style={styles.chartTitle}>{currentIdx?.label ?? 'Select'}</Text>
              </View>
              {currentData && (
                <View style={styles.priceRow}>
                  <Text style={[styles.price, { color: currentData.change24h >= 0 ? COLORS.success : COLORS.danger }]}>
                    ${currentData.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </Text>
                  <Text style={[styles.change, { color: currentData.change24h >= 0 ? COLORS.success : COLORS.danger }]}>
                    {currentData.change24h >= 0 ? '+' : ''}{currentData.change24h.toFixed(2)}%
                  </Text>
                </View>
              )}
            </View>
            {chartData.datasets[0].data.length > 0 && (
              <LineChart
                data={chartData}
                width={chartWidth}
                height={240}
                chartConfig={{
                  backgroundGradientFrom: COLORS.surface,
                  backgroundGradientTo: COLORS.surface,
                  color: () => currentIdx?.color ?? COLORS.primary,
                  labelColor: () => COLORS.textSecondary,
                  propsForBackgroundLines: { strokeDasharray: '', stroke: 'rgba(148, 163, 184, 0.12)' },
                  decimalPlaces: 2,
                }}
                bezier
                style={styles.chart}
                withDots={false}
                withInnerLines={false}
                withOuterLines={false}
                withVerticalLines={false}
              />
            )}
          </Card>

          {currentSpike && (
            <Card style={[styles.spikeCard, currentSpike.isSpikeImminent && styles.spikeImminent]}>
              <View style={styles.spikeHeader}>
                <Text style={styles.spikeTitle}>Spike Predictor</Text>
                <Text style={[styles.spikeProb, {
                  color: currentSpike.isSpikeImminent ? COLORS.danger : currentSpike.spikeProbability > 50 ? COLORS.warning : COLORS.success,
                }]}>
                  {currentSpike.spikeProbability}%
                </Text>
              </View>
              <View style={styles.progressBar}>
                <View style={[styles.progressFill, {
                  width: `${currentSpike.spikeProbability}%`,
                  backgroundColor: currentSpike.isSpikeImminent ? COLORS.danger : currentSpike.spikeProbability > 50 ? COLORS.warning : COLORS.success,
                }]} />
              </View>
              <View style={styles.spikeGrid}>
                <SpikeStat label="Direction" value={currentSpike.expectedDirection === 'up' ? 'Hausse ↗' : 'Baisse ↘'} />
                <SpikeStat label="Ampleur" value={currentSpike.estimatedMagnitude} />
                <SpikeStat label="Dernier spike" value={`il y a ${currentSpike.timeSinceLastSpike}s`} />
                <SpikeStat label="Position" value={`${currentSpike.pricePosition}%`} />
              </View>
              {currentSpike.isSpikeImminent && (
                <View style={styles.imminentBanner}>
                  <Text style={styles.imminentText}>Spike imminent détecté !</Text>
                </View>
              )}
            </Card>
          )}

          <Card style={styles.legendCard}>
            <Text style={styles.legendTitle}>Comprendre les indices</Text>
            <View style={styles.legendRow}>
              <View style={[styles.legendDot, { backgroundColor: COLORS.success }]} />
              <Text style={styles.legendText}><Text style={{ fontWeight: '700', color: COLORS.success }}>Boom</Text> — Spikes à la hausse. Le 500 est le plus volatil.</Text>
            </View>
            <View style={styles.legendRow}>
              <View style={[styles.legendDot, { backgroundColor: COLORS.danger }]} />
              <Text style={styles.legendText}><Text style={{ fontWeight: '700', color: COLORS.danger }}>Crash</Text> — Spikes à la baisse. Le 1000 est le plus stable.</Text>
            </View>
          </Card>
        </>
      )}
    </ScrollView>
  );
}

function SpikeStat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.spikeStatItem}>
      <Text style={styles.spikeStatLabel}>{label}</Text>
      <Text style={styles.spikeStatValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: 16, paddingBottom: 32 },
  header: { marginBottom: 20 },
  title: { fontSize: 24, fontWeight: '800', color: COLORS.text },
  subtitle: { fontSize: 14, color: COLORS.textSecondary, marginTop: 4 },
  indicesRow: { marginBottom: 16 },
  indexBtn: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: COLORS.surfaceLight,
    marginRight: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  indexBtnContent: { alignItems: 'center' },
  indexLabel: { color: COLORS.textSecondary, fontSize: 13, fontWeight: '600' },
  indexChange: { fontSize: 11, marginTop: 2 },
  spikeDot: {
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: COLORS.danger, marginTop: 4,
  },
  chartCard: { marginBottom: 16, paddingBottom: 8 },
  chartHeader: { marginBottom: 12 },
  chartTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  colorDot: { width: 10, height: 10, borderRadius: 5 },
  chartTitle: { color: COLORS.textSecondary, fontSize: 14 },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 12, marginTop: 4 },
  price: { fontSize: 28, fontWeight: '800' },
  change: { fontSize: 14, fontWeight: '700' },
  chart: { borderRadius: 16 },
  spikeCard: { marginBottom: 16, borderWidth: 1, borderColor: 'rgba(148,163,184,0.15)' },
  spikeImminent: { borderColor: 'rgba(239,68,68,0.4)', backgroundColor: 'rgba(239,68,68,0.08)' },
  spikeHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  spikeTitle: { color: COLORS.textSecondary, fontSize: 14, fontWeight: '600' },
  spikeProb: { fontSize: 20, fontWeight: '800' },
  progressBar: { width: '100%', height: 6, backgroundColor: COLORS.surfaceLight, borderRadius: 3, overflow: 'hidden', marginBottom: 12 },
  progressFill: { height: '100%', borderRadius: 3 },
  spikeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  spikeStatItem: { width: '47%', backgroundColor: COLORS.surfaceLight, borderRadius: 8, padding: 8 },
  spikeStatLabel: { color: COLORS.textMuted, fontSize: 10, textTransform: 'uppercase' },
  spikeStatValue: { color: COLORS.text, fontSize: 13, fontWeight: '700', marginTop: 2 },
  imminentBanner: {
    marginTop: 12, padding: 10, borderRadius: 8,
    backgroundColor: 'rgba(239,68,68,0.15)',
    borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)',
  },
  imminentText: { color: COLORS.danger, fontWeight: '700', fontSize: 13, textAlign: 'center' },
  legendCard: { marginBottom: 12 },
  legendTitle: { color: COLORS.text, fontSize: 14, fontWeight: '700', marginBottom: 12 },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { color: COLORS.textSecondary, fontSize: 12, flex: 1 },
});
