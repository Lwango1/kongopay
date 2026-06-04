import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { LineChart } from 'react-native-chart-kit';
import { apiFetch } from '../services/api';
import { COLORS } from '../constants/theme';
import Card from '../components/ui/Card';
import PrimaryButton from '../components/ui/PrimaryButton';

type Ticker = { symbol: string; price: number; change24h: number; high24h: number; low24h: number; volume24h: number };
type OrderBook = { bids: [number, number][]; asks: [number, number][] };
type Candle = { timestamp: number; open: number; high: number; low: number; close: number; volume: number };

const SYMBOLS = ['BTC/USDT', 'ETH/USDT', 'BNB/USDT', 'SOL/USDT', 'KONG/USDT'];
const chartWidth = Dimensions.get('window').width - 48;

export default function TradingScreen({ route }: any) {
  const [ticker, setTicker] = useState<Ticker | null>(null);
  const [orderbook, setOrderbook] = useState<OrderBook | null>(null);
  const [candles, setCandles] = useState<Candle[]>([]);
  const [symbol, setSymbol] = useState(route.params?.symbol || 'BTC/USDT');
  const [amount, setAmount] = useState('');
  const [price, setPrice] = useState('');
  const [orderType, setOrderType] = useState<'market' | 'limit'>('market');
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [t, ob, c] = await Promise.all([
        apiFetch<Ticker>(`/trading/ticker?symbol=${symbol}`),
        apiFetch<OrderBook>(`/trading/orderbook?symbol=${symbol}&limit=10`),
        apiFetch<Candle[]>(`/trading/history?symbol=${symbol}&timeframe=1h&limit=30`),
      ]);
      setTicker(t);
      setOrderbook(ob);
      setCandles(c);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [symbol]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const placeOrder = async (side: 'buy' | 'sell') => {
    try {
      await apiFetch('/trading/order', {
        method: 'POST',
        body: JSON.stringify({
          symbol,
          type: orderType,
          side,
          amount: parseFloat(amount),
          price: orderType === 'limit' ? parseFloat(price) : undefined,
        }),
      });
      alert(`Ordre ${side} placé`);
      setAmount('');
      setPrice('');
    } catch (err: any) {
      alert(err.message);
    }
  };

  const change24hColor = ticker?.change24h != null && ticker.change24h >= 0 ? COLORS.success : COLORS.danger;

  const chartData = {
    labels: candles.slice(-6).map((item) => new Date(item.timestamp).getHours().toString()),
    datasets: [{ data: candles.slice(-6).map((item) => item.close) }],
  };

  return (
    <ScrollView
      style={styles.page}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={loadData} tintColor={COLORS.primary} />}
    >
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.symbolsRow}>
        {SYMBOLS.map((s) => (
          <TouchableOpacity
            key={s}
            style={[styles.symbolBtn, s === symbol && styles.symbolBtnActive]}
            onPress={() => setSymbol(s)}
          >
            <Text style={[styles.symbolText, s === symbol && styles.symbolTextActive]}>{s}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <Card style={styles.marketCard}>
        {loading && !ticker ? (
          <ActivityIndicator size="large" color={COLORS.primary} />
        ) : (
          <>
            <View style={styles.marketHeader}>
              <Text style={styles.marketTitle}>{ticker?.symbol || symbol}</Text>
              <Text style={[styles.marketPrice, { color: change24hColor }]}>${ticker?.price?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) ?? '0.00'}</Text>
            </View>
            <View style={styles.marketStats}>
              <Stat label="24h" value={`${ticker?.change24h?.toFixed(2) ?? '0.00'}%`} valueStyle={{ color: change24hColor }} />
              <Stat label="Haut" value={`$${ticker?.high24h?.toLocaleString() ?? '0'}`} />
              <Stat label="Bas" value={`$${ticker?.low24h?.toLocaleString() ?? '0'}`} />
            </View>
          </>
        )}
      </Card>

      {candles.length > 0 && (
        <Card style={styles.chartCard}>
          <LineChart
            data={chartData}
            width={chartWidth}
            height={220}
            chartConfig={chartConfig}
            bezier
            style={styles.chart}
            withDots={false}
            withInnerLines={false}
            withOuterLines={false}
          />
        </Card>
      )}

      {orderbook && (
        <Card style={styles.orderbookCard}>
          <Text style={styles.sectionTitle}>Carnet d'ordres</Text>
          <View style={styles.obHeader}>
            <Text style={styles.obHeaderText}>Prix</Text>
            <Text style={styles.obHeaderText}>Quantité</Text>
            <Text style={styles.obHeaderText}>Total</Text>
          </View>
          {orderbook.asks.slice(0, 5).reverse().map(([p, q], i) => (
            <View key={`a-${i}`} style={styles.obRow}>
              <Text style={[styles.obPrice, { color: COLORS.danger }]}>{p.toFixed(2)}</Text>
              <Text style={styles.obQty}>{q.toFixed(4)}</Text>
              <Text style={styles.obTotal}>{(p * q).toFixed(2)}</Text>
            </View>
          ))}
          <View style={styles.obSpread}>
            <Text style={styles.obSpreadText}>Spread: {(orderbook.asks[0]?.[0] ?? 0) - (orderbook.bids[0]?.[0] ?? 0)}</Text>
          </View>
          {orderbook.bids.slice(0, 5).map(([p, q], i) => (
            <View key={`b-${i}`} style={styles.obRow}>
              <Text style={[styles.obPrice, { color: COLORS.success }]}>{p.toFixed(2)}</Text>
              <Text style={styles.obQty}>{q.toFixed(4)}</Text>
              <Text style={styles.obTotal}>{(p * q).toFixed(2)}</Text>
            </View>
          ))}
        </Card>
      )}

      <Card style={styles.tradeCard}>
        <Text style={styles.sectionTitle}>Passer un ordre</Text>
        <View style={styles.orderTypeRow}>
          {(['market', 'limit'] as const).map((type) => (
            <TouchableOpacity
              key={type}
              style={[styles.orderTypeBtn, orderType === type && styles.orderTypeBtnActive]}
              onPress={() => setOrderType(type)}
            >
              <Text style={[styles.orderTypeText, orderType === type && styles.orderTypeTextActive]}>
                {type === 'market' ? 'Market' : 'Limit'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <TextInput
          style={styles.input}
          placeholder="Quantité"
          placeholderTextColor={COLORS.textMuted}
          value={amount}
          onChangeText={setAmount}
          keyboardType="decimal-pad"
        />
        {orderType === 'limit' && (
          <TextInput
            style={styles.input}
            placeholder="Prix (USDT)"
            placeholderTextColor={COLORS.textMuted}
            value={price}
            onChangeText={setPrice}
            keyboardType="decimal-pad"
          />
        )}

        <View style={styles.tradeButtons}>
          <PrimaryButton title="Acheter" onPress={() => placeOrder('buy')} style={styles.tradeButton} />
          <PrimaryButton title="Vendre" onPress={() => placeOrder('sell')} variant="danger" style={styles.tradeButton} />
        </View>
      </Card>
    </ScrollView>
  );
}

function Stat({ label, value, valueStyle }: { label: string; value: string; valueStyle?: any }) {
  return (
    <View style={styles.statItem}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, valueStyle]}>{value}</Text>
    </View>
  );
}

const chartConfig = {
  backgroundGradientFrom: COLORS.surface,
  backgroundGradientTo: COLORS.surface,
  color: () => COLORS.primary,
  labelColor: () => COLORS.textSecondary,
  propsForBackgroundLines: { strokeDasharray: '', stroke: 'rgba(148, 163, 184, 0.16)' },
  decimalPlaces: 2,
};

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: 16, paddingBottom: 32 },
  symbolsRow: { marginBottom: 16 },
  symbolBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, backgroundColor: COLORS.surfaceLight, marginRight: 10, borderWidth: 1, borderColor: COLORS.border },
  symbolBtnActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  symbolText: { color: COLORS.textSecondary, fontSize: 13 },
  symbolTextActive: { color: '#fff', fontWeight: '700' },
  marketCard: { marginBottom: 16 },
  marketHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  marketTitle: { color: COLORS.textSecondary, fontSize: 14 },
  marketPrice: { fontSize: 32, fontWeight: '800' },
  marketStats: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 16 },
  statItem: { width: '30%' },
  statLabel: { color: COLORS.textMuted, fontSize: 12, marginBottom: 6, textTransform: 'uppercase' },
  statValue: { color: COLORS.text, fontSize: 14, fontWeight: '700' },
  chartCard: { marginBottom: 16, paddingBottom: 8 },
  chart: { borderRadius: 24 },
  orderbookCard: { marginBottom: 16 },
  sectionTitle: { color: COLORS.text, fontSize: 16, fontWeight: '700', marginBottom: 12 },
  obHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10, paddingBottom: 8, borderBottomWidth: 1, borderColor: COLORS.border },
  obHeaderText: { color: COLORS.textMuted, fontSize: 11, flex: 1, textAlign: 'right' },
  obRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  obPrice: { fontSize: 12, flex: 1, textAlign: 'right' },
  obQty: { fontSize: 12, color: COLORS.textSecondary, flex: 1, textAlign: 'right' },
  obTotal: { fontSize: 12, color: COLORS.textSecondary, flex: 1, textAlign: 'right' },
  obSpread: { alignItems: 'center', paddingVertical: 10, borderTopWidth: 1, borderBottomWidth: 1, borderColor: COLORS.border, marginVertical: 8 },
  obSpreadText: { color: COLORS.textMuted, fontSize: 12 },
  tradeCard: { marginBottom: 12 },
  orderTypeRow: { flexDirection: 'row', marginBottom: 16, gap: 8 },
  orderTypeBtn: { flex: 1, padding: 12, borderRadius: 12, backgroundColor: COLORS.surfaceLight, alignItems: 'center' },
  orderTypeBtnActive: { backgroundColor: COLORS.primary },
  orderTypeText: { color: COLORS.textSecondary, fontWeight: '700' },
  orderTypeTextActive: { color: '#fff' },
  input: { backgroundColor: COLORS.surfaceLight, borderRadius: 16, padding: 16, fontSize: 16, color: COLORS.text, marginBottom: 12, borderWidth: 1, borderColor: COLORS.border },
  tradeButtons: { flexDirection: 'row', gap: 12 },
  tradeButton: { flex: 1 },
});
