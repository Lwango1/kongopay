import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  Dimensions,
  Alert,
  Vibration,
} from 'react-native';
import { LineChart } from 'react-native-chart-kit';
import { COLORS } from '../constants/theme';
import Card from '../components/ui/Card';
import { fetchDerivState, fetchSpikePrediction, fetchMarketScan, INDICES } from '../services/deriv';
import type { DerivState, SpikeMap, MarketScanResult, MarketOpportunity } from '../services/deriv';

const chartWidth = Dimensions.get('window').width - 48;

function formatChartData(history: number[]) {
  const labels = history.filter((_, i) => i % Math.max(1, Math.floor(history.length / 6)) === 0).map(() => '');
  return {
    labels: labels,
    datasets: [{ data: history.length > 0 ? history : [0] }],
  };
}

function getIndexColor(type: string, number: number): string {
  const idx = INDICES.find(i => i.type === type && i.number === number);
  return idx?.color ?? COLORS.primary;
}

function ScoreBar({ value, color }: { value: number; color: string }) {
  return (
    <View style={styles.scoreBarOuter}>
      <View style={[styles.scoreBarFill, { width: `${value}%`, backgroundColor: color }]} />
    </View>
  );
}

export default function DerivScreen() {
  const [state, setState] = useState<DerivState | null>(null);
  const [spikes, setSpikes] = useState<SpikeMap>({});
  const [scanResult, setScanResult] = useState<MarketScanResult | null>(null);
  const [activeKey, setActiveKey] = useState('BOOM_500');
  const [activeTab, setActiveTab] = useState<'detail' | 'scan'>('scan');
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [previousImminent, setPreviousImminent] = useState<string[]>([]);
  const previousImminentRef = useRef(previousImminent);
  previousImminentRef.current = previousImminent;

  const fetchData = useCallback(async () => {
    try {
      const { indices } = await fetchDerivState();
      setState(indices);

      const [scanResult] = await Promise.all([
        fetchMarketScan(),
        Promise.all(
          INDICES.map(async (idx) => {
            const key = `${idx.type}_${idx.number}`;
            const prediction = await fetchSpikePrediction(idx.type, idx.number);
            if (prediction) return [key, prediction] as const;
            return null;
          })
        ).then((results) => {
          const spikeMap: SpikeMap = {};
          for (const r of results) {
            if (r) spikeMap[r[0]] = r[1];
          }
          setSpikes(spikeMap);
        }),
      ]);

      if (scanResult) {
        setScanResult(scanResult);

        const imminentKeys = scanResult.opportunities
          .filter(o => o.isSpikeImminent)
          .map(o => `${o.type}_${o.number}`);

        const newAlerts = imminentKeys.filter(k => !previousImminentRef.current.includes(k));
        if (newAlerts.length > 0) {
          Vibration.vibrate(500);
          const newOpp = scanResult.opportunities.find(o =>
            newAlerts.includes(`${o.type}_${o.number}`)
          );
          if (newOpp) {
            Alert.alert(
              'Opportunité détectée !',
              `${newOpp.label} — ${newOpp.expectedDirection === 'up' ? 'Hausse' : 'Baisse'} imminente (${newOpp.spikeProbability}%)`,
              [{ text: 'Voir', onPress: () => setActiveKey(`${newOpp.type}_${newOpp.number}`) }]
            );
          }
        }
        setPreviousImminent(imminentKeys);
      }
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

  const imminentOpps = scanResult?.opportunities.filter(o => o.isSpikeImminent) ?? [];
  const sortedOpps = scanResult?.opportunities ?? [];

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
            <Text style={styles.subtitle}>Boom & Crash — Scan automatique en temps réel</Text>
          </View>

          <View style={styles.tabRow}>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'scan' && styles.tabActive]}
              onPress={() => setActiveTab('scan')}
            >
              <Text style={[styles.tabText, activeTab === 'scan' && styles.tabTextActive]}>
                Scan Global {imminentOpps.length > 0 ? `(${imminentOpps.length})` : ''}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'detail' && styles.tabActive]}
              onPress={() => setActiveTab('detail')}
            >
              <Text style={[styles.tabText, activeTab === 'detail' && styles.tabTextActive]}>
                Détail par indice
              </Text>
            </TouchableOpacity>
          </View>

          {activeTab === 'scan' ? (
            <>
              {imminentOpps.length > 0 && (
                <View style={styles.imminentSection}>
                  <View style={styles.imminentHeader}>
                    <View style={styles.imminentDot} />
                    <Text style={styles.imminentTitle}>
                      {imminentOpps.length} opportunité{imminentOpps.length > 1 ? 's' : ''} imminente{imminentOpps.length > 1 ? 's' : ''}
                    </Text>
                  </View>
                  {imminentOpps.map(opp => (
                    <TouchableOpacity
                      key={`${opp.type}_${opp.number}`}
                      style={styles.imminentCard}
                      onPress={() => {
                        setActiveKey(`${opp.type}_${opp.number}`);
                        setActiveTab('detail');
                      }}
                    >
                      <View style={styles.imminentCardHeader}>
                        <Text style={styles.imminentCardLabel}>{opp.label}</Text>
                        <Text style={styles.imminentCardProb}>{opp.spikeProbability}%</Text>
                      </View>
                      <View style={styles.imminentCardRow}>
                        <Text style={styles.imminentCardDir}>
                          {opp.expectedDirection === 'up' ? '↑ Hausse' : '↓ Baisse'} — {opp.estimatedMagnitude}
                        </Text>
                        <Text style={styles.imminentCardPrice}>
                          ${opp.currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {scanResult && (
                <Card style={styles.scanTableCard}>
                  <Text style={styles.scanTableTitle}>
                    {scanResult.totalAnalyzed} marchés analysés
                  </Text>
                  {sortedOpps.map(opp => {
                    const color = getIndexColor(opp.type, opp.number);
                    const isBest = scanResult.bestOpportunity &&
                      `${scanResult.bestOpportunity.type}_${scanResult.bestOpportunity.number}` === `${opp.type}_${opp.number}`;
                    const probColor = opp.isSpikeImminent ? COLORS.danger : opp.spikeProbability > 50 ? COLORS.warning : COLORS.success;

                    return (
                      <TouchableOpacity
                        key={`${opp.type}_${opp.number}`}
                        style={[styles.scanRow, opp.isSpikeImminent && styles.scanRowImminent]}
                        onPress={() => {
                          setActiveKey(`${opp.type}_${opp.number}`);
                          setActiveTab('detail');
                        }}
                      >
                        <View style={styles.scanRowLeft}>
                          <View style={[styles.scanDot, { backgroundColor: color }]} />
                          <View>
                            <View style={styles.scanRowTitle}>
                              <Text style={styles.scanLabel}>{opp.label}</Text>
                              {opp.isSpikeImminent && (
                                <View style={styles.scanAlertBadge}>
                                  <Text style={styles.scanAlertBadgeText}>ALERTE</Text>
                                </View>
                              )}
                              {isBest && !opp.isSpikeImminent && (
                                <View style={styles.scanTopBadge}>
                                  <Text style={styles.scanTopBadgeText}>TOP</Text>
                                </View>
                              )}
                            </View>
                            <Text style={[styles.scanPrice, { color: opp.change24h >= 0 ? COLORS.success : COLORS.danger }]}>
                              ${opp.currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                              {' '}
                              <Text style={styles.scanChange}>
                                {opp.change24h >= 0 ? '+' : ''}{opp.change24h.toFixed(2)}%
                              </Text>
                            </Text>
                          </View>
                        </View>
                        <View style={styles.scanRowRight}>
                          <ScoreBar value={opp.spikeProbability} color={probColor} />
                          <Text style={[styles.scanProbText, { color: probColor }]}>{opp.spikeProbability}%</Text>
                          <Text style={styles.scanDir}>
                            {opp.expectedDirection === 'up' ? '↗' : '↘'}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </Card>
              )}
            </>
          ) : (
            <>
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
            </>
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
  header: { marginBottom: 16 },
  title: { fontSize: 24, fontWeight: '800', color: COLORS.text },
  subtitle: { fontSize: 14, color: COLORS.textSecondary, marginTop: 4 },

  tabRow: { flexDirection: 'row', marginBottom: 16, gap: 8 },
  tab: {
    flex: 1, paddingVertical: 10, borderRadius: 10,
    backgroundColor: COLORS.surfaceLight, borderWidth: 1, borderColor: COLORS.border,
    alignItems: 'center',
  },
  tabActive: { backgroundColor: COLORS.primary + '20', borderColor: COLORS.primary },
  tabText: { color: COLORS.textSecondary, fontSize: 13, fontWeight: '600' },
  tabTextActive: { color: COLORS.primary },

  imminentSection: { marginBottom: 16 },
  imminentHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  imminentDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: COLORS.danger },
  imminentTitle: { color: COLORS.danger, fontSize: 14, fontWeight: '700' },
  imminentCard: {
    backgroundColor: 'rgba(239,68,68,0.1)',
    borderRadius: 12, borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)',
    padding: 12, marginBottom: 8,
  },
  imminentCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  imminentCardLabel: { color: '#fff', fontSize: 15, fontWeight: '700' },
  imminentCardProb: { color: COLORS.danger, fontSize: 18, fontWeight: '800' },
  imminentCardRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 },
  imminentCardDir: { color: COLORS.danger + 'cc', fontSize: 12 },
  imminentCardPrice: { color: '#fff', fontSize: 13, fontWeight: '700', fontVariant: ['tabular-nums'] },

  scanTableCard: { marginBottom: 16, paddingBottom: 12 },
  scanTableTitle: { color: COLORS.textSecondary, fontSize: 13, fontWeight: '600', marginBottom: 12 },
  scanRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 10, paddingHorizontal: 12,
    borderRadius: 10, marginBottom: 4,
    backgroundColor: COLORS.surfaceLight,
  },
  scanRowImminent: { backgroundColor: 'rgba(239,68,68,0.1)' },
  scanRowLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  scanDot: { width: 8, height: 8, borderRadius: 4 },
  scanRowTitle: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  scanLabel: { color: '#fff', fontSize: 14, fontWeight: '600' },
  scanAlertBadge: {
    paddingHorizontal: 4, paddingVertical: 1,
    borderRadius: 4, backgroundColor: 'rgba(239,68,68,0.2)',
    borderWidth: 1, borderColor: 'rgba(239,68,68,0.4)',
  },
  scanAlertBadgeText: { color: COLORS.danger, fontSize: 8, fontWeight: '800' },
  scanTopBadge: {
    paddingHorizontal: 4, paddingVertical: 1,
    borderRadius: 4, backgroundColor: 'rgba(124,58,237,0.2)',
    borderWidth: 1, borderColor: 'rgba(124,58,237,0.4)',
  },
  scanTopBadgeText: { color: COLORS.primary, fontSize: 8, fontWeight: '800' },
  scanPrice: { fontSize: 13, fontWeight: '700', fontVariant: ['tabular-nums'], marginTop: 2 },
  scanChange: { fontSize: 11, color: COLORS.textMuted, fontWeight: '400' },
  scanRowRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  scoreBarOuter: {
    width: 60, height: 4, borderRadius: 2,
    backgroundColor: COLORS.surfaceLight, overflow: 'hidden',
  },
  scoreBarFill: { height: '100%', borderRadius: 2 },
  scanProbText: { fontSize: 12, fontWeight: '700', width: 36, textAlign: 'right' },
  scanDir: { fontSize: 14, width: 16, textAlign: 'center' },

  indicesRow: { marginBottom: 16 },
  indexBtn: {
    paddingHorizontal: 16, paddingVertical: 12, borderRadius: 12,
    backgroundColor: COLORS.surfaceLight, marginRight: 10, borderWidth: 1, borderColor: COLORS.border,
  },
  indexBtnContent: { alignItems: 'center' },
  indexLabel: { color: COLORS.textSecondary, fontSize: 13, fontWeight: '600' },
  indexChange: { fontSize: 11, marginTop: 2 },
  spikeDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.danger, marginTop: 4 },

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
  imminentBanner: { marginTop: 12, padding: 10, borderRadius: 8, backgroundColor: 'rgba(239,68,68,0.15)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)' },
  imminentText: { color: COLORS.danger, fontWeight: '700', fontSize: 13, textAlign: 'center' },

  legendCard: { marginBottom: 12 },
  legendTitle: { color: COLORS.text, fontSize: 14, fontWeight: '700', marginBottom: 12 },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { color: COLORS.textSecondary, fontSize: 12, flex: 1 },
});
