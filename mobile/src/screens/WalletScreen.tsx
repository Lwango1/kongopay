import React, { useEffect, useState, useCallback } from 'react';
import { ScrollView, RefreshControl, View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../services/api';
import { COLORS } from '../constants/theme';
import Card from '../components/ui/Card';
import PrimaryButton from '../components/ui/PrimaryButton';

type Wallet = {
  balanceCdf: number;
  balanceUsd: number;
  cryptoBalances: Record<string, number>;
};

export default function WalletScreen({ navigation }: any) {
  const { user, logout, isAdmin } = useAuth();
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const loadWallet = useCallback(async () => {
    try {
      const data = await apiFetch<Wallet>('/wallet/balance');
      setWallet(data);
    } catch (err) {
      console.error(err);
    }
  }, []);

  useEffect(() => {
    loadWallet();
  }, [loadWallet]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadWallet();
    setRefreshing(false);
  };

  return (
    <ScrollView
      style={styles.page}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
    >
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Bonjour,</Text>
          <Text style={styles.username}>{user?.displayName || user?.email || 'Utilisateur'}</Text>
        </View>
        <PrimaryButton title="Déconnexion" onPress={logout} variant="danger" style={styles.logoutButton} />
      </View>

      <Card style={styles.balanceCard}>
        <Text style={styles.balanceLabel}>Solde disponible</Text>
        <Text style={styles.balanceCdf}>{wallet?.balanceCdf?.toLocaleString() ?? '0'} CDF</Text>
        <Text style={styles.balanceUsd}>~${wallet?.balanceUsd?.toFixed(2) ?? '0.00'} USD</Text>
      </Card>

      <Card style={styles.actionCard}>
        <Text style={styles.sectionTitle}>Actions rapides</Text>
        <View style={styles.actionsRow}>
          <TouchableOpacity style={[styles.quickAction, { backgroundColor: COLORS.surface }]} onPress={() => navigation.navigate('DepositTab')}>
            <Text style={styles.actionIcon}>📥</Text>
            <Text style={styles.actionTitle}>Dépôt</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.quickAction, { backgroundColor: COLORS.surface }]} onPress={() => navigation.navigate('TradingTab')}>
            <Text style={styles.actionIcon}>📈</Text>
            <Text style={styles.actionTitle}>Trading</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.quickAction, { backgroundColor: COLORS.surface }]}>
            <Text style={styles.actionIcon}>📤</Text>
            <Text style={styles.actionTitle}>Retrait</Text>
          </TouchableOpacity>
        </View>
      </Card>

      <Card style={styles.cryptoCard}>
        <View style={styles.cardHeader}>
          <Text style={styles.sectionTitle}>Portefeuille Crypto</Text>
          <Text style={styles.subtitle}>Valeur estimée</Text>
        </View>
        {wallet?.cryptoBalances && Object.keys(wallet.cryptoBalances).length > 0 ? (
          Object.entries(wallet.cryptoBalances).map(([crypto, amount]) => (
            <View key={crypto} style={styles.cryptoRow}>
              <View>
                <Text style={styles.cryptoSymbol}>{crypto}</Text>
                <Text style={styles.cryptoSubtitle}>Actif</Text>
              </View>
              <Text style={styles.cryptoAmount}>{amount}</Text>
            </View>
          ))
        ) : (
          <Text style={styles.emptyText}>Aucune crypto ajoutée pour le moment.</Text>
        )}
      </Card>

      {isAdmin && <PrimaryButton title="Espace Admin" onPress={() => navigation.navigate('AdminTab')} variant="secondary" />}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: 16, paddingBottom: 32 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  greeting: { color: COLORS.textSecondary, fontSize: 14 },
  username: { color: COLORS.text, fontSize: 22, fontWeight: '700', marginTop: 4 },
  logoutButton: { minWidth: 120 },
  balanceCard: { marginBottom: 20 },
  balanceLabel: { color: COLORS.textSecondary, fontSize: 13, textTransform: 'uppercase', letterSpacing: 1 },
  balanceCdf: { fontSize: 36, fontWeight: '800', color: COLORS.text, marginTop: 10 },
  balanceUsd: { color: COLORS.textSecondary, marginTop: 8, fontSize: 16 },
  actionCard: { marginBottom: 20 },
  sectionTitle: { color: COLORS.text, fontSize: 16, fontWeight: '700', marginBottom: 10 },
  actionsRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
  quickAction: { flex: 1, borderRadius: 20, padding: 18, alignItems: 'center', justifyContent: 'center', marginHorizontal: 4 },
  actionIcon: { fontSize: 24, marginBottom: 8 },
  actionTitle: { color: COLORS.text, fontSize: 14, fontWeight: '700' },
  cryptoCard: { marginBottom: 20 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  subtitle: { color: COLORS.textSecondary, fontSize: 12 },
  cryptoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 14, borderTopWidth: 1, borderTopColor: COLORS.border },
  cryptoSymbol: { color: COLORS.text, fontSize: 15, fontWeight: '700' },
  cryptoSubtitle: { color: COLORS.textMuted, fontSize: 12, marginTop: 4 },
  cryptoAmount: { color: COLORS.text, fontSize: 15, fontWeight: '700' },
  emptyText: { color: COLORS.textMuted, fontSize: 14, marginTop: 12 },
});
