import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, FlatList, StyleSheet, Alert, RefreshControl } from 'react-native';
import { apiFetch } from '../services/api';
import { COLORS } from '../constants/theme';
import Card from '../components/ui/Card';
import PrimaryButton from '../components/ui/PrimaryButton';

type Deposit = {
  id: string;
  userId: string;
  phoneNumber: string;
  operator: string;
  amountCdf: number;
  status: string;
  confirmedAt?: string;
};

export default function AdminScreen() {
  const [deposits, setDeposits] = useState<Deposit[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await apiFetch<Deposit[]>('/admin/pending-deposits');
      setDeposits(data);
    } catch (err: any) {
      Alert.alert('Erreur', err.message);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const approve = async (ref: string) => {
    try {
      await apiFetch(`/admin/approve-deposit/${ref}`, { method: 'POST' });
      Alert.alert('Succès', 'Dépôt approuvé');
      load();
    } catch (err: any) {
      Alert.alert('Erreur', err.message);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Dépôts en attente</Text>

      <FlatList
        data={deposits}
        keyExtractor={item => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
        renderItem={({ item }) => (
          <Card style={styles.card}>
            <View style={styles.row}>
              <Text style={styles.label}>Réf</Text>
              <Text style={styles.value}>{item.id}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Client</Text>
              <Text style={styles.value}>{item.userId.slice(0, 12)}...</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Téléphone</Text>
              <Text style={styles.value}>{item.phoneNumber}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Opérateur</Text>
              <Text style={styles.value}>{item.operator}</Text>
            </View>
            <View style={styles.row}> 
              <Text style={styles.label}>Montant</Text>
              <Text style={[styles.value, styles.amountText]}>{item.amountCdf.toLocaleString()} CDF</Text>
            </View>
            <PrimaryButton title="Approuver" onPress={() => approve(item.id)} style={styles.approveBtn} />
          </Card>
        )}
        ListEmptyComponent={<Text style={styles.empty}>Aucun dépôt en attente</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background, padding: 16 },
  title: { fontSize: 22, fontWeight: '800', color: COLORS.text, marginBottom: 16 },
  card: { marginBottom: 14 },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  label: { color: COLORS.textMuted, fontSize: 13 },
  value: { color: COLORS.text, fontSize: 13, textAlign: 'right', maxWidth: '60%' },
  amountText: { fontWeight: '700', color: COLORS.success },
  approveBtn: { marginTop: 12, minHeight: 46 },
  empty: { color: COLORS.textMuted, textAlign: 'center', marginTop: 60, fontSize: 16 },
});
