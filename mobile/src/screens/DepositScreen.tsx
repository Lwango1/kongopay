import React, { useState } from 'react';
import { ScrollView, Text, StyleSheet, View, Alert } from 'react-native';
import { apiFetch } from '../services/api';
import { COLORS } from '../constants/theme';
import Card from '../components/ui/Card';
import PrimaryButton from '../components/ui/PrimaryButton';
import PrimaryInput from '../components/ui/PrimaryInput';

const OPERATORS = [
  { id: 'AIRTEL', name: 'Airtel Money', color: '#e31b23' },
  { id: 'ORANGE', name: 'Orange Money', color: '#ff7900' },
  { id: 'MPESA', name: 'M-Pesa', color: '#4caf50' },
];

const steps = ['Opérateur', 'Montant', 'Confirmation', 'SMS'];

type StepKey = 'operator' | 'amount' | 'confirm' | 'sms';

export default function DepositScreen() {
  const [step, setStep] = useState<StepKey>('operator');
  const [selectedOperator, setSelectedOperator] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [amount, setAmount] = useState('');
  const [reference, setReference] = useState('');
  const [recipientNumber, setRecipientNumber] = useState('');
  const [smsCode, setSmsCode] = useState('');
  const [loading, setLoading] = useState(false);

  const initiateDeposit = async () => {
    if (!phoneNumber || !amount) {
      Alert.alert('Erreur', 'Merci de saisir un numéro et un montant.');
      return;
    }
    setLoading(true);
    try {
      const result = await apiFetch<any>('/mobile-money/deposit/initiate', {
        method: 'POST',
        body: JSON.stringify({
          phoneNumber,
          operator: selectedOperator,
          amountCdf: parseFloat(amount),
        }),
      });
      setReference(result.reference);
      setRecipientNumber(result.recipientNumber);
      setStep('confirm');
    } catch (err: any) {
      Alert.alert('Erreur', err.message);
    } finally {
      setLoading(false);
    }
  };

  const confirmDeposit = async () => {
    if (!smsCode) {
      Alert.alert('Erreur', 'Veuillez saisir le code SMS.');
      return;
    }
    setLoading(true);
    try {
      await apiFetch('/mobile-money/deposit/confirm', {
        method: 'POST',
        body: JSON.stringify({ reference, smsCode }),
      });
      Alert.alert('Succès', 'Dépôt confirmé ! En attente de validation.');
      setStep('operator');
      setAmount('');
      setPhoneNumber('');
      setSmsCode('');
      setSelectedOperator('');
      setReference('');
      setRecipientNumber('');
    } catch (err: any) {
      Alert.alert('Erreur', err.message);
    } finally {
      setLoading(false);
    }
  };

  const currentTitle = {
    operator: 'Choisissez un opérateur',
    amount: 'Entrez le montant',
    confirm: 'Confirmez le transfert',
    sms: 'Saisissez le code SMS',
  }[step];

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      <Text style={styles.title}>{currentTitle}</Text>
      <View style={styles.progressRow}>
        {steps.map((label, index) => {
          const active = index <= ['operator', 'amount', 'confirm', 'sms'].indexOf(step);
          return <View key={label} style={[styles.stepDot, active && styles.stepDotActive]} />;
        })}
      </View>

      {step === 'operator' && (
        <View style={styles.grid}> 
          {OPERATORS.map(op => (
            <Card key={op.id} style={[styles.operatorCard, { borderColor: op.color }]}> 
              <Text style={[styles.operatorName, { color: op.color }]}>{op.name}</Text>
              <PrimaryButton
                title="Sélectionner"
                onPress={() => {
                  setSelectedOperator(op.id);
                  setStep('amount');
                }}
                style={styles.fullButton}
              />
            </Card>
          ))}
        </View>
      )}

      {step === 'amount' && (
        <Card style={styles.card}> 
          <PrimaryInput
            label="Numéro"
            placeholder="0789 123 456"
            value={phoneNumber}
            onChangeText={setPhoneNumber}
            keyboardType="phone-pad"
          />
          <PrimaryInput
            label="Montant (CDF)"
            placeholder="100000"
            value={amount}
            onChangeText={setAmount}
            keyboardType="decimal-pad"
          />
          <PrimaryButton title="Continuer" onPress={initiateDeposit} disabled={loading} />
          <Text style={styles.secondaryAction} onPress={() => setStep('operator')}>
            Retour
          </Text>
        </Card>
      )}

      {step === 'confirm' && (
        <Card style={styles.card}>
          <Text style={styles.summaryLabel}>Envoyez</Text>
          <Text style={styles.summaryValue}>{Number(amount).toLocaleString()} CDF</Text>
          <Text style={styles.summaryNote}>Opérateur: {selectedOperator}</Text>
          <Text style={styles.summaryNote}>Référence: {reference}</Text>
          <Text style={styles.summaryNote}>Destinataire: {recipientNumber}</Text>
          <PrimaryButton title="J’ai envoyé" onPress={() => setStep('sms')} />
          <Text style={styles.secondaryAction} onPress={() => setStep('amount')}>
            Modifier
          </Text>
        </Card>
      )}

      {step === 'sms' && (
        <Card style={styles.card}>
          <PrimaryInput
            label="Code SMS"
            placeholder="123456"
            value={smsCode}
            onChangeText={setSmsCode}
            keyboardType="numeric"
          />
          <PrimaryButton title="Confirmer" onPress={confirmDeposit} disabled={loading} />
        </Card>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: 16, paddingBottom: 32 },
  title: { color: COLORS.text, fontSize: 24, fontWeight: '800', marginBottom: 14 },
  progressRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 24 },
  stepDot: { width: 10, height: 10, borderRadius: 999, backgroundColor: COLORS.surface, marginRight: 10 },
  stepDotActive: { backgroundColor: COLORS.primary },
  grid: { gap: 12 },
  operatorCard: { marginBottom: 12 },
  operatorName: { fontSize: 18, fontWeight: '700', marginBottom: 16 },
  card: { padding: 20, marginBottom: 14 },
  fullButton: { width: '100%' },
  secondaryAction: { color: COLORS.primary, textAlign: 'center', marginTop: 18, fontWeight: '700' },
  summaryLabel: { color: COLORS.textSecondary, fontSize: 13, textTransform: 'uppercase', marginBottom: 10 },
  summaryValue: { color: COLORS.text, fontSize: 32, fontWeight: '800', marginBottom: 16 },
  summaryNote: { color: COLORS.textSecondary, fontSize: 14, marginBottom: 8 },
});
