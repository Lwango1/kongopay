import React, { useState } from 'react';
import { View, Text, StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator, TouchableOpacity, StatusBar } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { COLORS } from '../constants/theme';
import Card from '../components/ui/Card';
import PrimaryButton from '../components/ui/PrimaryButton';
import PrimaryInput from '../components/ui/PrimaryInput';

export default function LoginScreen() {
  const { login, register } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    setError('');
    setLoading(true);
    try {
      if (isLogin) {
        await login(email, password);
      } else {
        await register(email, password, name);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.page}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <StatusBar barStyle="light-content" backgroundColor={COLORS.background} />
      <View style={styles.container}>
        <View style={styles.brand}>
          <Text style={styles.logo}>KongoPay</Text>
          <Text style={styles.subtitle}>Gérez vos cryptos et dépôts mobiles simplement.</Text>
        </View>

        <Card style={styles.card}>
          <Text style={styles.title}>{isLogin ? 'Connexion' : "Créer un compte"}</Text>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          {!isLogin && (
            <PrimaryInput
              label="Nom complet"
              placeholder="Jean Dupont"
              value={name}
              onChangeText={setName}
            />
          )}

          <PrimaryInput
            label="Adresse email"
            placeholder="jean@exemple.com"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
          />

          <PrimaryInput
            label="Mot de passe"
            placeholder="••••••••"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />

          <PrimaryButton
            title={isLogin ? 'Se connecter' : 'S’inscrire'}
            onPress={handleSubmit}
            disabled={loading}
          />

          <View style={styles.switchRow}>
            <Text style={styles.switchText}>{isLogin ? 'Nouvel utilisateur ?' : 'Vous avez déjà un compte ?'}</Text>
            <TouchableOpacity onPress={() => setIsLogin(!isLogin)}>
              <Text style={styles.switchAction}>{isLogin ? 'Créer un compte' : 'Se connecter'}</Text>
            </TouchableOpacity>
          </View>
        </Card>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  brand: {
    marginBottom: 28,
  },
  logo: {
    fontSize: 40,
    fontWeight: '800',
    color: COLORS.primary,
  },
  subtitle: {
    marginTop: 12,
    color: COLORS.textSecondary,
    fontSize: 16,
    lineHeight: 24,
    maxWidth: 320,
  },
  card: {
    padding: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 16,
  },
  error: {
    color: COLORS.danger,
    marginBottom: 12,
    fontSize: 13,
  },
  switchRow: {
    marginTop: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  switchText: {
    color: COLORS.textSecondary,
    fontSize: 13,
  },
  switchAction: {
    color: COLORS.primary,
    fontSize: 13,
    fontWeight: '700',
  },
});
